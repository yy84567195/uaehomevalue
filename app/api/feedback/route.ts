import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = String(body?.message || "").trim();
    const email = String(body?.email || "").trim();
    const page = String(body?.page || "").trim();

    if (!message || message.length < 3) {
      return NextResponse.json({ error: "Message too short" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const mailFrom = process.env.MAIL_FROM;
    const feedbackTo = process.env.FEEDBACK_EMAIL || mailFrom;

    if (resendKey && mailFrom && feedbackTo) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: mailFrom,
        to: feedbackTo,
        subject: `[UAEHomeValue Feedback] ${email || "Anonymous"}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;padding:20px;color:#0f172a">
            <h3 style="margin:0 0 12px">New Feedback</h3>
            <p><strong>From:</strong> ${email || "Anonymous"}</p>
            <p><strong>Page:</strong> ${page || "N/A"}</p>
            <p><strong>Message:</strong></p>
            <div style="background:#f1f5f9;padding:12px;border-radius:8px;white-space:pre-wrap">${message}</div>
          </div>
        `,
      });
    } else {
      console.log("[Feedback]", { email, message, page });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Feedback error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
