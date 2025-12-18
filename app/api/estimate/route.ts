import { NextResponse } from "next/server";
import data from "@/data/price_ranges.json";

type ReqBody = {
  area: string;
  type: "Apartment" | "Villa";
  beds: number;
  sizeSqft: number;
};

function asNum(n: any, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function norm(s: any) {
  return String(s ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  const body = (await req.json()) as ReqBody;

  const areaIn = norm(body.area);
  const typeIn = norm(body.type);
  const bedsIn = asNum(body.beds, 0);
  const sizeIn = asNum(body.sizeSqft, 0);

  const rows: any[] = (data as any)?.communities ?? [];

  // You may have different keys in your json; keep it flexible:
  // Expect row.area, row.type, row.beds, row.min, row.max, row.ppsfMin, row.ppsfMax etc.
  const candidates = rows
    .map((r) => ({
      area: norm(r.area),
      type: norm(r.type ?? r.propertyType ?? r.ptype),
      beds: asNum(r.beds ?? r.bedrooms ?? r.br, 0),
      min: asNum(r.min ?? r.minPrice ?? r.low, 0),
      max: asNum(r.max ?? r.maxPrice ?? r.high, 0),
      ppsfMin: asNum(r.ppsfMin ?? r.minPpsf ?? r.lowPpsf, 0),
      ppsfMax: asNum(r.ppsfMax ?? r.maxPpsf ?? r.highPpsf, 0),
    }))
    .filter((r) => r.area);

  // 1) strict match
  let pick = candidates.filter((r) => r.area === areaIn && r.type === typeIn && r.beds === bedsIn);
  let confidence: "High" | "Medium" | "Low" = "High";

  // 2) same area + type, any beds
  if (!pick.length) {
    pick = candidates.filter((r) => r.area === areaIn && r.type === typeIn);
    confidence = "Medium";
  }

  // 3) same area, any type
  if (!pick.length) {
    pick = candidates.filter((r) => r.area === areaIn);
    confidence = "Low";
  }

  // 4) global fallback
  if (!pick.length) {
    pick = candidates;
    confidence = "Low";
  }

  // Compute estimate:
  // Prefer explicit min/max; otherwise use ppsf range * size
  let min = 0;
  let max = 0;

  // Use median of available ranges to be stable
  const mins = pick.map((r) => (r.min > 0 ? r.min : r.ppsfMin > 0 ? r.ppsfMin * sizeIn : 0)).filter((x) => x > 0);
  const maxs = pick.map((r) => (r.max > 0 ? r.max : r.ppsfMax > 0 ? r.ppsfMax * sizeIn : 0)).filter((x) => x > 0);

  mins.sort((a, b) => a - b);
  maxs.sort((a, b) => a - b);

  const midMin = mins.length ? mins[Math.floor(mins.length / 2)] : 0;
  const midMax = maxs.length ? maxs[Math.floor(maxs.length / 2)] : 0;

  min = Math.round(midMin);
  max = Math.round(midMax);

  // Ensure non-zero output
  if (!(min > 0 && max > 0) || max < min) {
    // very last fallback
    const base = sizeIn > 0 ? 1600 * sizeIn : 2_000_000; // conservative fallback
    min = Math.round(base * 0.92);
    max = Math.round(base * 1.08);
    confidence = "Low";
  }

  return NextResponse.json({ min, max, confidence });
}