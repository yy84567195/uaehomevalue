import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side only
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }});
}

export async function POST(req: Request) {
  const body = await req.json();
  const payload = {
    name: String(body?.name || ''),
    whatsapp: String(body?.whatsapp || ''),
    notes: String(body?.notes || ''),
    area: String(body?.area || ''),
    type: String(body?.type || ''),
    beds: Number(body?.beds || 0),
    size_sqft: Number(body?.sizeSqft || 0),
    estimate_min: Number(body?.estimateMin || 0),
    estimate_max: Number(body?.estimateMax || 0),
    created_at: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (!sb) {
    // Fallback: accept lead without storage (still lets WhatsApp open)
    return NextResponse.json({ ok: true, stored: false, message: 'Lead received (no database configured yet).' });
  }

  const { error } = await sb.from('leads').insert(payload);
  if (error) {
    return NextResponse.json({ ok: false, stored: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: true });
}
