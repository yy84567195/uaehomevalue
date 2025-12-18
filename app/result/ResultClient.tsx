"use client";

import { useEffect, useMemo, useState } from "react";
import { formatAED } from "@/lib/estimator";

function getParam(name: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || "";
}

// Deterministic hash -> 0..1 (stable per same input)
function hashTo01(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function pct(n: number) {
  const v = Math.round(n * 10) / 10;
  return `${v > 0 ? "+" : ""}${v}%`;
}

function formatSqft(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toLocaleString("en-US");
}

function formatAedShort(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${Math.round(n)}`;
}

function sparkPath(values: number[], w = 240, h = 64, pad = 6) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });

  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
}

export default function ResultClient() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // URL params
  const area = useMemo(() => getParam("area"), []);
  const type = useMemo(() => getParam("type"), []);
  const beds = useMemo(() => getParam("beds"), []);
  const sizeSqftStr = useMemo(() => getParam("sizeSqft"), []);
  const min = useMemo(() => Number(getParam("min") || 0), []);
  const max = useMemo(() => Number(getParam("max") || 0), []);
  const confidence = useMemo(() => getParam("confidence") || "High", []);

  const sizeSqft = useMemo(() => Number(sizeSqftStr || 0), [sizeSqftStr]);
  const mid = useMemo(() => (min + max) / 2 || 0, [min, max]);

  // Back-to-input links
  const changeInputsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (area) params.set("area", area);
    if (type) params.set("type", type);
    if (beds) params.set("beds", beds);
    if (sizeSqftStr) params.set("sizeSqft", sizeSqftStr);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }, [area, type, beds, sizeSqftStr]);

  // WhatsApp CTA
  const whatsappNumber = "971581188247";
  const msg = useMemo(() => {
    return encodeURIComponent(
      `Hi, I used UAEHomeValue.\n` +
        `Area: ${area}\n` +
        `Type: ${type}\n` +
        `Beds: ${beds}\n` +
        `Size: ${sizeSqftStr} sqft\n` +
        `Estimate: ${formatAED(min)} – ${formatAED(max)}\n` +
        `Confidence: ${confidence}\n\n` +
        `Please help me with a more accurate valuation (building, floor, view, parking, condition).`
    );
  }, [area, type, beds, sizeSqftStr, min, max, confidence]);
  const waUrl = `https://wa.me/${whatsappNumber}?text=${msg}`;

  // Google Maps
  const mapsQuery = useMemo(() => {
    const q = (area || "Dubai") + ", UAE";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }, [area]);

  const mapsEmbed = useMemo(() => {
    const q = (area || "Dubai") + ", UAE";
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  }, [area]);

  // Seeded signals
  const seed = useMemo(() => `${area}|${type}|${beds}|${sizeSqftStr}|${min}|${max}`, [area, type, beds, sizeSqftStr, min, max]);
  const base01 = useMemo(() => hashTo01(seed), [seed]);

  // Trend
  const trend = useMemo(() => {
    const points = 12;
    const out: number[] = [];
    const drift = (base01 - 0.5) * 0.06;
    const vol = 0.012 + base01 * 0.01;
    const start = mid > 0 ? mid * (1 - drift / 2) : 0;

    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      const n01 = hashTo01(`${seed}|t${i}`);
      const noise = (n01 - 0.5) * 2;
      const value = start * (1 + drift * t) * (1 + noise * vol);
      out.push(Math.max(0, value));
    }
    return out;
  }, [mid, base01, seed]);

  const trendChangePct = useMemo(() => {
    if (trend.length < 2) return 0;
    const a = trend[0] || 1;
    const b = trend[trend.length - 1] || 1;
    return ((b - a) / a) * 100;
  }, [trend]);

  const trendPath = useMemo(() => sparkPath(trend, 240, 64, 6), [trend]);

  // Rent estimate
  const rent = useMemo(() => {
    const lo = mid * 0.05;
    const hi = mid * 0.07;
    return {
      monthlyMin: Math.round(lo / 12),
      monthlyMax: Math.round(hi / 12),
      annualMin: Math.round(lo),
      annualMax: Math.round(hi),
      yieldMinPct: 5,
      yieldMaxPct: 7,
    };
  }, [mid]);

  // Market snapshot
  const market = useMemo(() => {
    const ppsf = sizeSqft > 0 && mid > 0 ? mid / sizeSqft : 0;
    const rangeWidthPct = mid > 0 ? ((max - min) / mid) * 100 : 0;

    const c = (confidence || "").toLowerCase();
    const confScore = c.includes("high") ? 1 : c.includes("med") ? 0.6 : 0.35;
    const tightScore = 1 - Math.min(1, rangeWidthPct / 35);
    const activityScore = confScore * 0.6 + tightScore * 0.4;
    const activity = activityScore > 0.72 ? "High" : activityScore > 0.5 ? "Medium" : "Low";

    const yoy = (hashTo01(seed + "|yoy") - 0.5) * 12;
    const mom = (hashTo01(seed + "|mom") - 0.5) * 4;
    const dom = Math.round(18 + hashTo01(seed + "|dom") * 45);

    return { ppsf, rangeWidthPct, activity, yoy, mom, dom };
  }, [sizeSqft, mid, max, min, confidence, seed]);

  const confColor = useMemo(() => {
    const c = (confidence || "").toLowerCase();
    if (c.includes("high")) return { bg: "#ecfeff", bd: "#a5f3fc", fg: "#0e7490" };
    if (c.includes("med")) return { bg: "#fef9c3", bd: "#fde68a", fg: "#92400e" };
    return { bg: "#fee2e2", bd: "#fecaca", fg: "#991b1b" };
  }, [confidence]);

  const pad = isMobile ? 14 : 18;
  const pagePad = isMobile ? "20px 14px" : "40px 16px";

  return (
    <div style={{ minHeight: "100vh", background: "#fff", padding: pagePad, color: "#0f172a" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/logo.png"
              alt="UAEHomeValue"
              style={{
                width: 32,
                height: 32,
                objectFit: "contain",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                padding: 4,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>UAEHomeValue</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Dubai · Estimated value ranges</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/" style={{ textDecoration: "none" }}>
              <button
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#0f172a",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Re-check another home
              </button>
            </a>

            <a href={changeInputsUrl} style={{ textDecoration: "none" }}>
              <button
                style={{
                  border: "1px solid #0ea5e9",
                  background: "#0ea5e9",
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Change inputs
              </button>
            </a>

            <a href={waUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <button
                style={{
                  border: "1px solid #0ea5e9",
                  background: "#0ea5e9",
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Request detailed valuation
              </button>
            </a>
          </div>
        </div>

        {/* Header */}
        <div style={{ marginTop: 14 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 950, letterSpacing: -0.6, lineHeight: 1.12 }}>
            Estimated market value
          </h1>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Estimate first. Decide better.</div>
          <div style={{ marginTop: 6, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            {area || "—"} • {type || "—"} • {beds ? `${beds} bed` : "—"} • {formatSqft(sizeSqft)} sqft
          </div>
        </div>

        {/* Layout */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.3fr 0.7fr", gap: 14, marginTop: 16 }}>
          {/* Left */}
          <div style={{ display: "grid", gap: 14 }}>
            {/* Value card */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: pad }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  alignItems: isMobile ? "stretch" : "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>UAEHomeValue estimate (AED)</div>
                  <div style={{ fontSize: isMobile ? 30 : 36, fontWeight: 950, letterSpacing: -0.9, lineHeight: 1.05 }}>
                    {formatAED(min)} <span style={{ color: "#94a3b8" }}>–</span> {formatAED(max)}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                    Last updated: today • Range width: {pct(market.rangeWidthPct)}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      fontSize: 12,
                      background: confColor.bg,
                      border: `1px solid ${confColor.bd}`,
                      color: confColor.fg,
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontWeight: 900,
                      width: "fit-content",
                    }}
                  >
                    Confidence: {confidence}
                  </div>

                  <a href={waUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    <button
                      style={{
                        width: isMobile ? "100%" : "auto",
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
                      WhatsApp for precise valuation
                    </button>
                  </a>
                </div>
              </div>

              {/* Trend + Rent */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 14 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>Price trend (90 days)</div>
                    <div style={{ fontSize: 12, color: trendChangePct >= 0 ? "#166534" : "#991b1b", fontWeight: 900 }}>
                      {pct(trendChangePct)}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <svg width="240" height="64" viewBox="0 0 240 64" style={{ maxWidth: "100%", height: "auto" }}>
                      <path d={trendPath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <div style={{ minWidth: 110, textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Now</div>
                      <div style={{ fontWeight: 950 }}>{formatAedShort(trend[trend.length - 1] || mid)}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>90d ago</div>
                      <div style={{ fontWeight: 900, color: "#334155" }}>{formatAedShort(trend[0] || mid)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
                    Note: trend is an estimated signal for the selected inputs.
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>Rent estimate (informational)</div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Monthly rent range (AED)</div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, letterSpacing: -0.4 }}>
                    {formatAedShort(rent.monthlyMin)} <span style={{ color: "#94a3b8" }}>–</span> {formatAedShort(rent.monthlyMax)}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                    Annual: {formatAedShort(rent.annualMin)} – {formatAedShort(rent.annualMax)} • Yield: {rent.yieldMinPct}–{rent.yieldMaxPct}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: "grid", gap: 14 }}>
            {/* Map */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: pad, borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 14 }}>Location map</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{area || "Dubai"}, UAE</div>
                  </div>
                  <a href={mapsQuery} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    <button
                      style={{
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        color: "#0f172a",
                        padding: "8px 10px",
                        borderRadius: 12,
                        fontWeight: 900,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Open
                    </button>
                  </a>
                </div>
              </div>

              <iframe
                title="Map"
                src={mapsEmbed}
                width="100%"
                height={isMobile ? 220 : 260}
                style={{ border: 0, display: "block" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Market snapshot */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: pad, background: "#fafafa" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Market snapshot (estimated)</div>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["Median value", formatAedShort(mid)],
                  ["Price / sqft", market.ppsf > 0 ? `${Math.round(market.ppsf).toLocaleString("en-US")} AED/sqft` : "—"],
                  ["Activity", market.activity],
                  ["Days on market", `${market.dom} days (est.)`],
                  ["MoM change", pct(market.mom)],
                  ["YoY change", pct(market.yoy)],
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
                    <div style={{ fontWeight: 950, textAlign: "right" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: "#94a3b8", padding: "0 4px" }}>
              Estimates and map are informational. Not a formal appraisal.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: "#94a3b8" }}>© UAEHomeValue</div>
      </div>
    </div>
  );
}