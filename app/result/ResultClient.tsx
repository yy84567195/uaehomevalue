"use client";

import { useMemo } from "react";
import { formatAED } from "@/lib/estimator";

function getParam(name: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

export default function ResultClient() {
  const area = useMemo(() => getParam("area"), []);
  const type = useMemo(() => getParam("type"), []);
  const beds = useMemo(() => getParam("beds"), []);
  const sizeSqft = useMemo(() => getParam("sizeSqft"), []);
  const min = useMemo(() => Number(getParam("min") || 0), []);
  const max = useMemo(() => Number(getParam("max") || 0), []);
  const confidence = useMemo(() => getParam("confidence") || "Medium", []);

  /* Simple rental reference (very conservative, neutral) */
  const annualRentLow = Math.round(min * 0.045);
  const annualRentHigh = Math.round(max * 0.055);

  const whatsappNumber = "971581188247";
  const whatsappText = encodeURIComponent(
    `Hi, I used UAEHomeValue and would like a detailed valuation review.\n\n` +
      `Area: ${area}\n` +
      `Type: ${type}\n` +
      `Bedrooms: ${beds}\n` +
      `Size: ${sizeSqft} sqft\n` +
      `Estimated value: ${formatAED(min)} – ${formatAED(max)}\n\n` +
      `Please let me know what additional details are needed.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  const backToHome = `/?area=${encodeURIComponent(
    area
  )}&type=${encodeURIComponent(type)}&beds=${encodeURIComponent(
    beds
  )}&sizeSqft=${encodeURIComponent(sizeSqft)}`;

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", padding: "24px 16px", color: "#0f172a" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Top branding & navigation */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.3, marginBottom: 6 }}>
            Estimate first. Decide better.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/" style={{ textDecoration: "none" }}>
              <button
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Re-check another home
              </button>
            </a>

            <a href={backToHome} style={{ textDecoration: "none" }}>
              <button
                style={{
                  border: "1px solid #0ea5e9",
                  background: "#0ea5e9",
                  color: "#ffffff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Change inputs
              </button>
            </a>
          </div>
        </div>

        {/* Main estimate */}
        <div style={{ padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6 }}>
            Estimated market value
          </div>

          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.5 }}>
            {formatAED(min)} <span style={{ color: "#94a3b8" }}>–</span> {formatAED(max)}
          </div>

          <div
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: "#ecfeff",
              border: "1px solid #a5f3fc",
              color: "#0e7490",
            }}
          >
            Confidence: {confidence}
          </div>

          <div style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>
            {area} · {type} · {beds} bed · {sizeSqft} sqft
          </div>
        </div>

        {/* Grid: map + market snapshot */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 20,
          }}
        >
          {/* Map */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
            <iframe
              title="Map"
              src={`https://www.google.com/maps?q=${encodeURIComponent(area + ", Dubai")}&output=embed`}
              width="100%"
              height="260"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Market snapshot */}
          <div style={{ padding: 20, borderRadius: 16, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>
              Market snapshot
            </div>

            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <b>Estimated annual rent (reference):</b>
              <br />
              {formatAED(annualRentLow)} – {formatAED(annualRentHigh)}
              <br /><br />

              <b>Yield indication:</b>
              <br />
              Approximately 4.5% – 5.5% based on current market ranges.
              <br /><br />

              <b>Market note:</b>
              <br />
              Prices in {area} can vary significantly by building quality,
              floor level, view and unit condition.
            </div>
          </div>
        </div>

        {/* Methodology */}
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: 13,
            lineHeight: 1.7,
            color: "#334155",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            How this estimate is calculated
          </div>

          <div>
            This estimate is generated using recent listing ranges from similar
            homes in the same community, adjusted by size, property type and
            current market signals.
            <br /><br />
            Estimates are presented as a <b>price range</b> to reflect natural
            market variability. This is a market-based estimate, not a formal appraisal.
          </div>
        </div>

        {/* Neutral CTA */}
        <div style={{ marginTop: 20 }}>
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <button
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                border: "none",
                background: "#0ea5e9",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Request a detailed valuation review
            </button>
          </a>

          <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
            Independent, market-based review · No property listings · No agent representation
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 28, fontSize: 12, color: "#94a3b8" }}>
          © UAEHomeValue · Independent market-based valuation tool
        </div>
      </div>
    </div>
  );
}