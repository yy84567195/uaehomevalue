import { NextResponse } from "next/server";
import data from "@/data/price_ranges.json";

type Confidence = "High" | "Medium" | "Low";

function norm(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function median(nums: number[]) {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return NaN;
  return arr[Math.floor(arr.length / 2)];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const areaRaw = body?.area;
    const typeRaw = body?.type;
    const bedsRaw = body?.beds;
    const sizeSqftRaw = body?.sizeSqft;

    const area = norm(areaRaw);
    const type = norm(typeRaw);
    const beds = Number(bedsRaw ?? 0);
    const sizeSqft = Number(sizeSqftRaw);

    if (!area || !type || !Number.isFinite(sizeSqft) || sizeSqft <= 0) {
      return NextResponse.json({ error: "Missing/invalid fields" }, { status: 400 });
    }

    const communities = (data as any)?.communities ?? [];
    const allRows = Array.isArray(communities) ? communities : [];

    // 1) 精确匹配：area + type
    let rows = allRows.filter((r: any) => norm(r?.area) === area && norm(r?.type) === type);

    // 2) 次优匹配：只匹配 type（同类型全局）
    if (!rows.length) {
      rows = allRows.filter((r: any) => norm(r?.type) === type);
    }

    // 3) 再不行：全量
    if (!rows.length) {
      rows = allRows;
    }

    // 取 ppsf
    const ppsfList = rows
      .map((r: any) => Number(r?.ppsf))
      .filter((n: number) => Number.isFinite(n) && n > 0);

    // 如果数据里没有 ppsf，就用一个迪拜粗略 fallback（避免 0）
    // 你可以后面用真实数据替换这个默认值
    const basePpsf = Number.isFinite(median(ppsfList)) ? (median(ppsfList) as number) : 1800;

    // bedrooms 轻微修正（不要太夸张）
    const bedFactor = beds === 0 ? 0.98 : beds === 1 ? 1.0 : beds === 2 ? 1.03 : beds === 3 ? 1.06 : 1.08;

    const mid = basePpsf * sizeSqft * bedFactor;

    // confidence：根据样本量 + ppsf 离散度
    const n = ppsfList.length;
    const conf: Confidence = n >= 10 ? "High" : n >= 4 ? "Medium" : "Low";

    // 区间宽度：High 更窄，Low 更宽（但别夸张）
    // 另外根据 ppsf 的离散程度再微调
    let band = conf === "High" ? 0.10 : conf === "Medium" ? 0.15 : 0.22;

    if (ppsfList.length >= 6) {
      const lo = ppsfList[Math.floor(ppsfList.length * 0.2)];
      const hi = ppsfList[Math.floor(ppsfList.length * 0.8)];
      const spread = (hi - lo) / basePpsf; // 0.x
      band = clamp(band + spread * 0.10, 0.08, 0.28);
    }

    const min = Math.round(mid * (1 - band));
    const max = Math.round(mid * (1 + band));

    // ✅ 兜底：绝不允许 0
    const safeMin = Math.max(min, 1);
    const safeMax = Math.max(max, safeMin + 1);

    return NextResponse.json({
      min: safeMin,
      max: safeMax,
      confidence: conf,
      source: rows === allRows ? "fallback_all" : "matched",
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}