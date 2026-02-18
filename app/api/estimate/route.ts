// app/api/estimate/route.ts
import { NextRequest, NextResponse } from "next/server";
import data from "@/data/price_ranges.json";

type Row = {
  area: string;
  community?: string;
  type: "Apartment" | "Villa";
  beds: number;
  min: number;
  max: number;
};

function normalizeStr(v: any) {
  return String(v ?? "").trim();
}

function normKey(v: any) {
  return normalizeStr(v).toLowerCase();
}

// ✅ beds=6 代表 4+，自动向下兜底：6 -> 5 -> 4
function bedsCandidates(beds: number) {
  if (!Number.isFinite(beds)) return [];
  if (beds >= 6) return [6, 5, 4];
  if (beds === 5) return [5, 4];
  return [beds];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ✅ 根据 sizeSqft 做一个轻量的“面积调整”
// - 以同档位 comps 的中位面积为基准（如果没有 comps，用 1000 sqft 当基准）
// - 调整幅度限制在 ±25%（避免离谱）
function sizeAdjustFactor(area: string, community: string, type: string, beds: number, sizeSqft: number) {
  const comps = (data as any)?.comps ?? [];
  const aKey = normKey(area);
  const cKey = normKey(community);

  const pool = comps
    .filter((x: any) => normKey(x?.area) === aKey)
    .filter((x: any) => !community || normKey(x?.community) === cKey)
    .filter((x: any) => normKey(x?.beds) === normKey(beds));

  const sizes = pool
    .map((x: any) => Number(x?.size_sqft))
    .filter((n: number) => Number.isFinite(n) && n > 0)
    .sort((p: number, q: number) => p - q);

  const base = sizes.length
    ? sizes[Math.floor(sizes.length / 2)]
    : 1000;

  if (!Number.isFinite(sizeSqft) || sizeSqft <= 0) return 1;

  const raw = sizeSqft / base;

  // 对数压缩一下，不让变化太夸张
  // 例如：2倍面积不会让价格2倍，只是偏大一些
  const compressed = Math.pow(raw, 0.85);

  return clamp(compressed, 0.75, 1.25);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const area = normalizeStr(body?.area);
    const community = normalizeStr(body?.community); // ✅ 可选
    const building = normalizeStr(body?.building);   // ✅ 先占位，后面可用于采样/训练
    const type = normalizeStr(body?.type) as "Apartment" | "Villa";
    const beds = Number(body?.beds);
    const sizeSqft = Number(body?.sizeSqft);

    if (!area || (type !== "Apartment" && type !== "Villa") || !Number.isFinite(beds) || beds < 0) {
      return NextResponse.json(
        { error: "Invalid request. Please provide area/type/beds/sizeSqft." },
        { status: 400 }
      );
    }

    const rows: Row[] = ((data as any)?.communities ?? []) as Row[];

    const aKey = normKey(area);
    const cKey = normKey(community);
    const tKey = normKey(type);

const candidates = bedsCandidates(beds);

// 先社区级（community 精确）
let picked: any[] = [];
if (community) {
  for (const b of candidates) {
    const found = rows.filter(
      (r) =>
        r.area === area &&
        r.type === type &&
        Number(r.beds) === b &&
        String(r.community || "") === String(community)
    );
    if (found.length) {
      picked = found;
      break;
    }
  }
}

// 再区域级（无 community 的行）
if (!picked.length) {
  for (const b of candidates) {
    const found = rows.filter(
      (r) =>
        r.area === area &&
        r.type === type &&
        Number(r.beds) === b &&
        !r.community
    );
    if (found.length) {
      picked = found;
      break;
    }
  }
}

    // ✅ 2) fallback：area 级（没有 community 字段的行）
    if (!picked.length) {
      for (const b of candidates) {
        const found = rows.filter((r) => {
          if (normKey(r?.area) !== aKey) return false;
          if (normKey(r?.type) !== tKey) return false;
          if (Number(r?.beds) !== b) return false;
          if (r?.community) return false; // 只要 area-level
          return true;
        });
        if (found.length) {
          picked = found;
          break;
        }
      }
    }

    if (!picked.length) {
  return NextResponse.json(
  { error: "NO_DATA" },
  { status: 404 }
);
    }

    // ✅ 取范围：如果同一档多行，取 min 的最小、max 的最大
    const baseMin = Math.min(...picked.map((r) => Number(r.min)).filter((n) => Number.isFinite(n) && n > 0));
    const baseMax = Math.max(...picked.map((r) => Number(r.max)).filter((n) => Number.isFinite(n) && n > 0));

    if (!Number.isFinite(baseMin) || !Number.isFinite(baseMax) || baseMax <= baseMin) {
      return NextResponse.json(
        { error: "Estimate data is incomplete for this selection." },
        { status: 500 }
      );
    }

    // ✅ 面积微调
    const factor = sizeAdjustFactor(area, community, type, candidates[0] ?? beds, sizeSqft);
    const min = Math.round(baseMin * factor);
    const max = Math.round(baseMax * factor);

    // ✅ 简单置信度：community 匹配更高；bed 兜底更低
    const usedBeds = picked[0]?.beds ?? beds;
    const isCommunityMatched = !!community && normKey(picked[0]?.community) === cKey;
    const isFallbackBeds = Number(usedBeds) !== Number(beds);

    const confidence =
      isCommunityMatched && !isFallbackBeds ? "High" :
      isCommunityMatched && isFallbackBeds ? "Medium" :
      !isCommunityMatched && !isFallbackBeds ? "Medium" :
      "Low";

    const baseRentMin = Math.min(...picked.map((r: any) => Number(r.rent_min || 0)).filter((n: number) => n > 0)) || 0;
    const baseRentMax = Math.max(...picked.map((r: any) => Number(r.rent_max || 0)).filter((n: number) => n > 0)) || 0;
    const rentMin = baseRentMin > 0 ? Math.round(baseRentMin * factor) : 0;
    const rentMax = baseRentMax > 0 ? Math.round(baseRentMax * factor) : 0;

    return NextResponse.json({
      min, max, confidence,
      rent_min: rentMin,
      rent_max: rentMax,
      matched: isCommunityMatched ? "community" : "area",
      debug: { area, community, building, type, beds, bedsUsed: usedBeds, sizeSqft, factor },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid JSON or server error." },
      { status: 400 }
    );
  }
}