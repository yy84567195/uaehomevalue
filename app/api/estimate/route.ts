import { NextResponse } from 'next/server';
import { estimateValue } from '@/lib/estimator';

export async function POST(req: Request) {
  const body = await req.json();
  const { area, type, beds, sizeSqft } = body || {};
  const result = estimateValue({
    area: String(area || ''),
    type: (type === 'Villa' ? 'Villa' : 'Apartment'),
    beds: Number(beds || 0),
    sizeSqft: Number(sizeSqft || 0),
  });
  return NextResponse.json(result);
}
