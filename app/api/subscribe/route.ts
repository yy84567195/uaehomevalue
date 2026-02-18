import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function sendConfirmEmail(email: string, locale: string, confirmToken: string) {
  const resendKey = process.env.RESEND_API_KEY;
  const mailFrom = process.env.MAIL_FROM;
  if (!resendKey || !mailFrom) return;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uaehomevalue.com";
  const confirmUrl = `${baseUrl}/api/subscribe/confirm?token=${confirmToken}`;
  const unsubUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`;

  const resend = new Resend(resendKey);
  const subject = "Confirm your UAEHomeValue subscription";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="font-size:20px;font-weight:900;margin:0 0 12px">UAEHomeValue — Monthly Market Report</h2>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6">
        You signed up for the free monthly Dubai property market report.<br>
        Click below to confirm your subscription.
      </p>
      <a href="${confirmUrl}" style="display:inline-block;padding:12px 22px;background:#3b82f6;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
        Confirm Subscription
      </a>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">
        If you didn't request this, you can safely ignore this email.<br>
        <a href="${unsubUrl}" style="color:#94a3b8">Unsubscribe</a>
      </p>
    </div>
  `;

  try {
    await resend.emails.send({ from: mailFrom, to: email, subject, html });
  } catch (e) {
    console.error("Resend confirm email failed:", e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const locale = String(body?.locale || "en").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }

    const confirmToken = generateToken();
    const unsubToken = generateToken();

    const sb = getSupabase();

    if (sb) {
      const { error } = await sb.from("subscriptions").upsert(
        { email, locale, confirmed: false, confirm_token: confirmToken, unsub_token: unsubToken },
        { onConflict: "email", ignoreDuplicates: false }
      );
      if (error) {
        console.error("Supabase upsert error:", error);
      }
    }

    await sendConfirmEmail(email, locale, confirmToken);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Subscribe error:", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
