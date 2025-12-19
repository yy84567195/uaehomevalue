import { NextResponse } from "next/server";
import data from "@/data/price_ranges.json";

/**
 * 核心思路（像 Zillow）：
 * 1. 先算一个「锚点价」（community + type + beds 的中位）
 * 2. 再根据 size 做线性调整
 * 3. 最后根据 confidence 给不同宽度的估值区间
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { area, type, beds, sizeSqft } = body;

    if (!area || !type || !sizeSqft) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ===== 1️⃣ 从数据中找到社区 & 类型匹配 =====
    const communities = (data as any)?.communities ?? [];
    const rows = communities.filter(
      (r: any) =>
        String(r.area).toLowerCase() === String(area).toLowerCase() &&
        String(r.type).toLowerCase() === String(type).toLowerCase()
    );

    if (!rows.length) {
      // 没有精确匹配 → 返回低置信度宽区间
      const fallbackMid = 1800 * sizeSqft; // 粗略 fallback
      return NextResponse.json({
        min: Math.round(fallbackMid * 0.75),
        max: Math.round(fallbackMid * 1.25),
        confidence: "Low",
      });
    }

    // ===== 2️⃣ 计算锚点价（price per sqft 中位）=====
    const ppsfList = rows.map((r: any) => Number(r.ppsf)).filter(Boolean);
    const medianPpsf =
      ppsfList.sort((a, b) => a - b)[Math.floor(ppsfList.length / 2)];

    const anchorPrice = medianPpsf * Number(sizeSqft);

    // ===== 3️⃣ Bedrooms 微调（很轻）=====
    const bedFactor =
      beds === 0 ? 0.98 : beds === 1 ? 1 : beds === 2 ? 1.02 : 1.04;

    const adjustedMid = anchorPrice * bedFactor;

    // ===== 4️⃣ 置信度判断 =====
    let confidence: "High" | "Medium" | "Low" = "Medium";

    if (rows.length >= 6) confidence = "High";
    if (rows.length <= 2) confidence = "Low";

    // ===== 5️⃣ 区间宽度控制（关键！）=====
    /**
     * 这是你现在和之前最大的不同点：
     * - High：非常像 Zillow（±8% ~ ±10%）
     * - Medium：市场常见波动（±15%）
     * - Low：数据不足，明显更宽
     */
    let bandPct = 0.15;

    if (confidence === "High") bandPct = 0.1;
    if (confidence === "Low") bandPct = 0.22;

    const min = Math.round(adjustedMid * (1 - bandPct));
    const max = Math.round(adjustedMid * (1 + bandPct));

    return NextResponse.json({
      min,
      max,
      confidence,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}