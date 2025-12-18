"use client";

import { useMemo, useState } from "react";
import { formatAED } from "@/lib/estimator";

function getParam(name: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

export default function ResultClient() {
  const [faqOpen, setFaqOpen] = useState(false);

  const area = useMemo(() => getParam("area"), []);
  const type = useMemo(() => getParam("type"), []);
  const beds = useMemo(() => getParam("beds"), []);
  const sizeSqft = useMemo(() => getParam("sizeSqft"), []);
  const min = useMemo(() => Number(getParam("min") || 0), []);
  const max = useMemo(() => Number(getParam("max") || 0), []);

  const whatsappNumber = "971581188247";
  const msg = encodeURIComponent(
    `Hi, I used UAEHomeValue.\n` +
      `Area: ${area}\n` +
      `Type: ${type}\n` +
      `Beds: ${beds}\n` +
      `Size: ${sizeSqft} sqft\n` +
      `Estimate: ${formatAED(min)} – ${formatAED(max)}\n\n` +
      `Please help me with a more accurate valuation.`
  );
  const waUrl = `https://wa.me/${whatsappNumber}?text=${msg}`;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", padding: "40px 16px", color: "#0f172a" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>UAEHomeValue</div>
            <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.4, fontWeight: 900 }}>
              Instant property value range in the UAE
            </h1>
            <div style={{ marginTop: 8, fontSize: 14, color: "#475569", lineHeight: 1.6, maxWidth: 640 }}>
              Free estimate based on nearby market signals. No sign-up required. For a refined valuation, message us on
              WhatsApp.
            </div>
          </div>

          <a href={waUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button
              style={{
                border: "1px solid #0ea5e9",
                background: "#0ea5e9",
                color: "#fff",
                padding: "12px 14px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              WhatsApp me
            </button>
          </a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14, marginTop: 18 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Estimated range (AED)</div>
                <div style={{ fontSize: 32, fontWeight: 950, letterSpacing: -0.8 }}>
                  {formatAED(min)} <span style={{ color: "#94a3b8" }}>–</span> {formatAED(max)}
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#0f172a",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "6px 10px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                }}
              >
                Confidence: High
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>What can change the price?</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["🪟 View", "Sea / Marina / Open view can add a premium"],
                  ["🏢 Floor", "Higher floors often price higher"],
                  ["🧱 Layout", "Usable layout beats wasted space"],
                  ["🛠 Condition", "Renovation level shifts value quickly"],
                ].map(([title, desc]) => (
                  <div key={title} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{title}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 13, color: "#334155" }}>
                Want a precise number?
                <span style={{ color: "#64748b" }}> Share unit details on WhatsApp.</span>
              </div>

              <a href={waUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    border: "1px solid #0ea5e9",
                    background: "#ffffff",
                    color: "#0ea5e9",
                    padding: "10px 12px",
                    borderRadius: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Open WhatsApp
                </button>
              </a>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 18, background: "#fafafa" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Your inputs</div>

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["Area", area || "—"],
                  ["Property type", type || "—"],
                  ["Bedrooms", beds || "—"],
                  ["Size (sqft)", sizeSqft || "—"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#64748b" }}>{k}</div>
                    <div style={{ fontWeight: 900 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Next steps</div>

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["1) Confirm unit details", "Building, floor, view, balcony, parking"],
                  ["2) Check latest comps", "Recent sales/rents nearby"],
                  ["3) Get a refined valuation", "We reply on WhatsApp with a tighter range"],
                ].map(([t, d]) => (
                  <div key={t} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{t}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
          <button
            onClick={() => setFaqOpen(!faqOpen)}
            style={{
              width: "100%",
              textAlign: "left",
              border: "1px solid #e2e8f0",
              background: "#fff",
              padding: "12px 12px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            {faqOpen ? "Hide FAQ" : "Show FAQ"}
          </button>

          {faqOpen && (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {[
                ["Is this an official valuation?", "No. It's an informational estimate, not a certified appraisal."],
                ["Why do prices vary so much?", "View, floor, layout, condition and comps can move price quickly."],
                ["How to get a precise number?", "Send building + unit details on WhatsApp and we’ll refine the range."],
              ].map(([q, a]) => (
                <div key={q} style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{q}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{a}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: "#94a3b8" }}>
          © {new Date().getFullYear()} UAEHomeValue · Estimates are informational, not a formal appraisal.
        </div>
      </div>
    </div>
  );
}