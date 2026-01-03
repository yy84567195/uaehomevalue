import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side only
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sendEmail(payload: any) {
  // 没配 Resend 就直接跳过（不报错，不影响用户提交）
  const resendKey = process.env.RESEND_API_KEY;
  const mailTo = process.env.MAIL_TO;
  const mailFrom = process.env.MAIL_FROM;

  if (!resendKey || !mailTo || !mailFrom) return;

  const resend = new Resend(resendKey);

  const subject = "New UAEHomeValue submission";

  const html = `
    <h2>New Submission</h2>
    <ul>
      <li><b>Name:</b> ${payload.name || "-"}</li>
      <li><b>WhatsApp:</b> ${payload.whatsapp || "-"}</li>
      <li><b>Notes:</b> ${payload.notes || "-"}</li>
      <li><b>Area:</b> ${payload.area || "-"}</li>
      <li><b>Type:</b> ${payload.type || "-"}</li>
      <li><b>Beds:</b> ${Number(payload.beds || 0)}</li>
      <li><b>Size:</b> ${Number(payload.size_sqft || 0)} sqft</li>
      <li><b>Estimate:</b> AED ${Number(payload.estimate_min || 0).toLocaleString()} - ${Number(
        payload.estimate_max || 0
      ).toLocaleString()}</li>
      <li><b>Time:</b> ${payload.created_at}</li>
    </ul>
  `;

  // 邮件失败不影响主流程
  try {
    await resend.emails.send({
      from: mailFrom,
      to: mailTo,
      subject,
      html,
    });
  } catch (e) {
    console.error("Resend email failed:", e);
  }
}

export async function POST(req: Request) {
  const body = await req.json();

  const payload = {
    name: String(body?.name || ""),
    whatsapp: String(body?.whatsapp || ""),
    notes: String(body?.notes || ""),
    area: String(body?.area || ""),
    type: String(body?.type || ""),
    beds: Number(body?.beds || 0),
    size_sqft: Number(body?.sizeSqft || 0),
    estimate_min: Number(body?.estimateMin || 0),
    estimate_max: Number(body?.estimateMax || 0),
    created_at: new Date().toISOString(),
  };

  const sb = getSupabase();

  // ✅ 没配数据库：照样发邮件（如果配了 Resend），并返回 ok
  if (!sb) {
    await sendEmail(payload);
    return NextResponse.json({
      ok: true,
      stored: false,
      emailed: true,
      message: "Lead received (no database configured yet).",
    });
  }

  const { error } = await sb.from("leads").insert(payload);

  // ✅ 写库失败：也照样尝试发邮件（避免丢线索）
  if (error) {
    await sendEmail(payload);
    return NextResponse.json(
      { ok: false, stored: false, emailed: true, error: error.message },
      { status: 500 }
    );
  }

  // ✅ 写库成功：再发邮件
  await sendEmail(payload);
  return NextResponse.json({ ok: true, stored: true, emailed: true });
}