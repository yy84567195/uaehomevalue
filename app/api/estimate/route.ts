import { NextResponse } from "next/server";
import data from "@/data/price_ranges.json";

type Confidence = "High" | "Medium" | "Low";

// 更像 Zillow 的 MVP：
// 1) 先用数据算社区+类型的 ppsf 中位数 -> anchor
// 2) 床位微调
// 3) 区域系数（让“换区域必然变”）
// 4) 根据 rows 数量决定置信度 & 区间宽度
// 5) 数据为空时 fallback 也用“区域系数”，避免各区域同价

function median(nums: number[]) {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)] || 0;
}

function normalizeArea(s: string) {
  return String(s || "").trim().toLowerCase();
}
function normalizeType(s: string) {
  return String(s || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const areaRaw = body?.area;
    const typeRaw = body?.type;
    const bedsRaw = body?.beds;
    const sizeSqftRaw = body?.sizeSqft;

    const area = String(areaRaw ?? "").trim();
    const type = String(typeRaw ?? "").trim();
    const beds = Number(bedsRaw ?? 0);
    const sizeSqft = Number(sizeSqftRaw ?? 0);

    if (!area || !type || !Number.isFinite(sizeSqft) || sizeSqft <= 0) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    // ✅ 关键：区域系数（你可以继续补全）
    // 先保证几个核心区差异明显，让产品“像 Zillow”
    const areaFactorMap: Record<string, number> = {
      "Palm Jumeirah": 1.28,
      "Downtown Dubai": 1.22,
      "Dubai Marina": 1.12,
      "Business Bay": 1.02,
      "JLT": 0.95,
      "Jumeirah Lake Towers": 0.95,
      "JVC": 0.88,
      "Dubai Hills": 1.10,
      "Arabian Ranches": 1.08,
    };

    const areaFactor = areaFactorMap[area] ?? 1.0;

    // 数据
    const communities = (data as any)?.communities ?? [];

    // ✅ 尽量稳：area + type 严格匹配（忽略大小写）
    const rows = communities.filter((r: any) => {
      const a = normalizeArea(r?.area);
      const t = normalizeType(r?.type);
      return a === normalizeArea(area) && t === normalizeType(type);
    });

    // bedrooms 微调（轻）
    const bedFactor =
      beds === 0 ? 0.98 :
      beds === 1 ? 1.00 :
      beds === 2 ? 1.02 :
      beds === 3 ? 1.04 : 1.06;

    // ===== 1) 有数据：用 ppsf 中位数 =====
    if (rows.length) {
      const ppsfList = rows
        .map((r: any) => Number(r?.ppsf))
        .filter((n: number) => Number.isFinite(n) && n > 0);

      const medianPpsf = median(ppsfList);

      // 极端：ppsf 没有可用值，走 fallback
      if (!medianPpsf) {
        const fallbackPpsf = 1800 * areaFactor; // ✅ fallback 也带区域差
        const mid = fallbackPpsf * sizeSqft * bedFactor;

        const confidence: Confidence = "Low";
        const bandPct = 0.22;

        return NextResponse.json({
          min: Math.round(mid * (1 - bandPct)),
          max: Math.round(mid * (1 + bandPct)),
          confidence,
          meta: { reason: "no_ppsf_in_rows", rows: rows.length },
        });
      }

      // ✅ 核心：面积×ppsf×床位×区域系数
      const mid = medianPpsf * sizeSqft * bedFactor * areaFactor;

      // ===== 2) 置信度：看 rows 数量 =====
      let confidence: Confidence = "Medium";
      if (rows.length >= 6) confidence = "High";
      if (rows.length <= 2) confidence = "Low";

      // ===== 3) 区间宽度（像 Zillow：高置信更窄）=====
      let bandPct = 0.15;
      if (confidence === "High") bandPct = 0.10;
      if (confidence === "Low") bandPct = 0.22;

      const min = Math.round(mid * (1 - bandPct));
      const max = Math.round(mid * (1 + bandPct));

      return NextResponse.json({
        min,
        max,
        confidence,
        meta: {
          rows: rows.length,
          medianPpsf,
          areaFactor,
          bedFactor,
          model: "median_ppsf * size * bedFactor * areaFactor",
        },
      });
    }

    // ===== 2) 没数据：fallback（也要随区域变化）=====
    // 用一个“Dubai 基准 ppsf”，乘 areaFactor
    const fallbackPpsf = 1800 * areaFactor;
    const mid = fallbackPpsf * sizeSqft * bedFactor;

    const confidence: Confidence = "Low";
    const bandPct = 0.25;

    return NextResponse.json({
      min: Math.round(mid * (1 - bandPct)),
      max: Math.round(mid * (1 + bandPct)),
      confidence,
      meta: { reason: "no_rows_match", areaFactor, bedFactor },
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}