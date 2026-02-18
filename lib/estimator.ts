import data from '@/data/price_ranges.json';

export type EstimateInput = {
  area: string;
  type: 'Apartment' | 'Villa';
  beds: number;
  sizeSqft: number;
};

export type EstimateOutput = {
  min: number;
  max: number;
  confidence: 'High' | 'Medium' | 'Low';
  comps: Array<{ label: string; beds: number; size_sqft: number; price: number; date: string }>;
  notes: string[];
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function estimateValue(input: EstimateInput): EstimateOutput {
  const rows = (data as any).communities as Array<any>;
  const compsAll = (data as any).comps as Array<any>;

  // Find best match: same area + type + beds
  const exact = rows.find(r => r.area === input.area && r.type === input.type && r.beds === input.beds);

  // Fallbacks
  const sameAreaType = rows.filter(r => r.area === input.area && r.type === input.type);
  const plusMinus = sameAreaType.find(r => r.beds === input.beds - 1) || sameAreaType.find(r => r.beds === input.beds + 1);

  const picked = exact || plusMinus || sameAreaType[0];

  let confidence: EstimateOutput['confidence'] = 'Low';
  if (exact) confidence = 'Medium';
  if (exact && sameAreaType.length >= 3) confidence = 'High';

  if (!picked) {
    return {
      min: 0,
      max: 0,
      confidence: 'Low',
      comps: [],
      notes: ['No market data for this selection yet. Try a nearby area or community.'],
    };
  }

  // Size adjustment (light-touch): normalize around typical sizes by bedrooms (rough heuristic)
  const typical = input.beds <= 0 ? 550 : input.beds === 1 ? 850 : input.beds === 2 ? 1250 : input.beds === 3 ? 1750 : 2400;
  const ratio = clamp(input.sizeSqft / typical, 0.75, 1.35); // avoid extreme effects
  const baseMin = Math.round(picked.min * ratio);
  const baseMax = Math.round(picked.max * ratio);

  // Safety: output a range (wider if low confidence)
  const widen = confidence === 'High' ? 0.06 : confidence === 'Medium' ? 0.08 : 0.10;
  const mid = (baseMin + baseMax) / 2;
  const min = Math.round(mid * (1 - widen));
  const max = Math.round(mid * (1 + widen));

  const comps = compsAll
    .filter(c => c.area === input.area)
    .slice(0, 3);

  const notes: string[] = [
    'Estimated range based on similar homes in your area',
    'Reflects bedrooms and size (light adjustment)',
    'Use the Improve Accuracy option to refine with floor, view and condition',
  ];

  if (!exact) {
    notes.unshift('Note: exact match not found in starter dataset, using nearest match.');
    confidence = 'Low';
  }

  return { min, max, confidence, comps, notes };
}

export function formatAED(n: number) {
  if (!n) return '—';
  // format like 2.35M, 850K
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `AED ${(n/1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `AED ${(n/1_000).toFixed(0)}K`;
  return `AED ${n.toFixed(0)}`;
}
