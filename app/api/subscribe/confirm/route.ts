import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  if (!token) {
    return new NextResponse("Invalid link", { status: 400 });
  }

  const sb = getSupabase();
  if (sb) {
    await sb
      .from("subscriptions")
      .update({ confirmed: true })
      .eq("confirm_token", token);
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Confirmed</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b1220;color:#f8fafc}
.box{text-align:center;padding:32px;max-width:420px}</style></head>
<body><div class="box">
<div style="font-size:36px;margin-bottom:12px">✓</div>
<h2 style="font-weight:900;margin:0 0 10px">You're subscribed!</h2>
<p style="color:#94a3b8;margin:0 0 20px">You'll receive the monthly Dubai property market report in your inbox.</p>
<a href="/" style="color:#3b82f6;font-weight:700;text-decoration:none">← Back to UAEHomeValue</a>
</div></body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
