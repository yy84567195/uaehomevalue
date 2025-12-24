import { NextResponse } from "next/server";
import data from "@/data/price_ranges.json";

type Confidence = "High" | "Medium" | "Low";

function normalize(s: string) {
  return String(s || "").trim().toLowerCase();
}

// 用一个“典型面积”让 sizeSqft 真实影响结果（MVP 必备）
// 你后续有真实分布数据再替换即可
function typicalSizeSqft(type: string, beds: number) {
  const t = normalize(type);

  // Apartment
  if (t === "apartment") {
    if (beds <= 0) return 550;
    if (beds === 1) return 850;
    if (beds === 2) return 1250;
    if (beds === 3) return 1700;
    return 2200; // 4+
  }

  // Villa（更大）
  if (beds <= 0) return 1800;
  if (beds === 1) return 2200;
  if (beds === 2) return 2800;
  if (beds === 3) return 3500;
  return 4500;
}

// 让“不同区域必然变”，但不会过度夸张
function areaFactor(area: string) {
  const m: Record<string, number> = {
    "palm jumeirah": 1.28,
    "downtown dubai": 1.22,
    "dubai marina": 1.12,
    "business bay": 1.02,
    "jlt": 0.95,
    "jumeirah lake towers": 0.95,
    "jvc": 0.88,
    "dubai hills": 1.10,
    "arabian ranches": 1.08,
  };

  return m[normalize(area)] ?? 1.0;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const area = String(body?.area ?? "").trim();
    const community = String(body?.community ?? "").trim(); // ✅ 新增：可选
    const type = String(body?.type ?? "").trim(); // "Apartment" | "Villa"
    const beds = Number(body?.beds ?? 0);
    const sizeSqft = Number(body?.sizeSqft ?? 0);

    if (!area || !type || !Number.isFinite(sizeSqft) || sizeSqft <= 0) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const rowsAll = (data as any)?.communities ?? [];

    // 统一按 area/type/beds 过滤（beds 也要匹配，不然会乱）
    const baseMatch = (r: any) =>
      normalize(r?.area) === normalize(area) &&
      normalize(r?.type) === normalize(type) &&
      Number(r?.beds) === Number(beds);

    // ✅ 1) community 优先（如果你的数据里有 community 字段就会命中）
    const communityRows = community
      ? rowsAll.filter((r: any) => baseMatch(r) && normalize(r?.community) === normalize(community))
      : [];

    // ✅ 2) fallback 到 area 级别
    const areaRows = rowsAll.filter((r: any) => baseMatch(r));

    const rows = communityRows.length ? communityRows : areaRows;

    // 没有任何匹配：fallback（仍按区域系数）
    if (!rows.length) {
      const af = areaFactor(area);
      const basePpsf = 1800 * af; // 你可以后续替换成更真实的基准
      const mid = basePpsf * sizeSqft;

      return NextResponse.json({
        min: Math.round(mid * 0.75),
        max: Math.round(mid * 1.25),
        confidence: "Low" as Confidence,
        meta: { reason: "no_match_rows", area, community, type, beds, areaFactor: af },
      });
    }

    // ✅ 从数据的 min/max 得到“基准区间”
    const mins = rows.map((r: any) => Number(r?.min)).filter((n: number) => Number.isFinite(n) && n > 0);
    const maxs = rows.map((r: any) => Number(r?.max)).filter((n: number) => Number.isFinite(n) && n > 0);

    if (!mins.length || !maxs.length) {
      return NextResponse.json({
        min: 0,
        max: 0,
        confidence: "Low" as Confidence,
        meta: { reason: "bad_min_max_in_rows", rows: rows.length },
      });
    }

    // 取一个稳的范围：min 取中位附近、max 取中位附近（MVP 简化）
    mins.sort((a, b) => a - b);
    maxs.sort((a, b) => a - b);
    const baseMin = mins[Math.floor(mins.length / 2)];
    const baseMax = maxs[Math.floor(maxs.length / 2)];

    // ✅ 用“典型面积”把区间按用户输入 sizeSqft 比例缩放
    const typical = typicalSizeSqft(type, beds);
    const scale = typical > 0 ? sizeSqft / typical : 1;

    const scaledMin = baseMin * scale;
    const scaledMax = baseMax * scale;

    // ✅ 置信度：community 命中 = High；只有 area 命中 = Medium；兜底 = Low
    let confidence: Confidence = "Medium";
    if (communityRows.length) confidence = "High";
    if (!areaRows.length) confidence = "Low";

    // 最终保护：max 必须 > min
    const minOut = Math.round(Math.min(scaledMin, scaledMax * 0.95));
    const maxOut = Math.round(Math.max(scaledMax, scaledMin * 1.05));

    return NextResponse.json({
      min: minOut,
      max: maxOut,
      confidence,
      meta: {
        matched: communityRows.length ? "community" : "area",
        rowsUsed: rows.length,
        baseMin,
        baseMax,
        typicalSizeSqft: typical,
        scale,
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}