"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
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

function sparkPath(values: number[], w = 220, h = 56, pad = 6) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });

  return pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

function valueAdjustments(t: (key: string) => string) {
  return [
    {
      label: t("result.adjustments.seaView.label"),
      impact: t("result.adjustments.seaView.impact"),
      note: t("result.adjustments.seaView.note"),
    },
    {
      label: t("result.adjustments.highFloor.label"),
      impact: t("result.adjustments.highFloor.impact"),
      note: t("result.adjustments.highFloor.note"),
    },
    {
      label: t("result.adjustments.upgraded.label"),
      impact: t("result.adjustments.upgraded.impact"),
      note: t("result.adjustments.upgraded.note"),
    },
    {
      label: t("result.adjustments.lowFloorRoad.label"),
      impact: t("result.adjustments.lowFloorRoad.impact"),
      note: t("result.adjustments.lowFloorRoad.note"),
    },
  ];
}

export default function ResultClient() {
  const t = useTranslations();
  const locale = useLocale();

  // 🔹 refine form state
  const [showRefine, setShowRefine] = useState(false);

  const [refineData, setRefineData] = useState({
    building: "",
    floor: "",
    view: "",
    condition: "",
    parking: "",
    expectedPrice: "",
    amenities: [] as string[],
  });

  const [refineResult, setRefineResult] = useState<null | {
    min: number;
    max: number;
    note: string;
  }>(null);

  const [minOverride, setMinOverride] = useState<number | null>(null);
  const [maxOverride, setMaxOverride] = useState<number | null>(null);
  const [confidenceOverride, setConfidenceOverride] = useState<string | null>(null);

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

  const minFinal = minOverride ?? min;
  const maxFinal = maxOverride ?? max;
  const confidenceFinal = confidenceOverride ?? confidence;

  const sizeSqft = useMemo(() => Number(sizeSqftStr || 0), [sizeSqftStr]);
  const mid = useMemo(() => (minFinal + maxFinal) / 2 || 0, [minFinal, maxFinal]);

  // ✅ 波动范围
  const band = useMemo(() => {
    const lo = Number(minFinal);
    const hi = Number(maxFinal);
    const m = (lo + hi) / 2;

    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo || !Number.isFinite(m) || m <= 0) {
      return { rangePct: 0, likelyPct: 0 };
    }

    const rangePct = ((hi - lo) / m) * 100;
    const c = String(confidenceFinal || "").toLowerCase();
    const tight = c.includes("high") ? 0.25 : c.includes("med") ? 0.35 : 0.5;
    const likelyPct = rangePct * tight;

    return { rangePct, likelyPct };
  }, [minFinal, maxFinal, confidenceFinal]);

  // ✅ Likely range（更窄的“可能成交区间”）
  const likely = useMemo(() => {
    if (!minFinal || !maxFinal || !mid || maxFinal <= minFinal) {
      return { likelyMin: minFinal, likelyMax: maxFinal, bandPct: 0 };
    }

    const c = (confidenceFinal || "").toLowerCase();
    const tight = c.includes("high") ? 0.25 : c.includes("med") ? 0.35 : 0.5;

    const halfBand = ((maxFinal - minFinal) * tight) / 2;

    const likelyMin = Math.round(Math.max(minFinal, mid - halfBand));
    const likelyMax = Math.round(Math.min(maxFinal, mid + halfBand));
    const bandPct = mid > 0 ? ((likelyMax - likelyMin) / mid) * 100 : 0;

    return { likelyMin, likelyMax, bandPct };
  }, [minFinal, maxFinal, mid, confidenceFinal]);

  // ✅ Back-to-input links（带 locale）
  const changeInputsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (area) params.set("area", area);
    if (type) params.set("type", type);
    if (beds) params.set("beds", beds);
    if (sizeSqftStr) params.set("sizeSqft", sizeSqftStr);
    const qs = params.toString();
    return qs ? `/${locale}/?${qs}` : `/${locale}`;
  }, [area, type, beds, sizeSqftStr, locale]);

  const homeUrl = useMemo(() => `/${locale}`, [locale]);

  // Google Maps (no API key)
  const mapsQuery = useMemo(() => {
    const q = `${area || "Dubai"}, UAE`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }, [area]);

  const mapsEmbed = useMemo(() => {
    const q = `${area || "Dubai"}, UAE`;
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  }, [area]);

  // Seeded “market signals”
  const seed = useMemo(
    () => `${area}|${type}|${beds}|${sizeSqftStr}|${minFinal}|${maxFinal}`,
    [area, type, beds, sizeSqftStr, minFinal, maxFinal]
  );
  const base01 = useMemo(() => hashTo01(seed), [seed]);

  // Trend (90 days) - 12 points
  const trend = useMemo(() => {
    const points = 12;
    const out: number[] = [];
    const drift = (base01 - 0.5) * 0.06; // -3%..+3% drift
    const vol = 0.012 + base01 * 0.01; // 1.2%..2.2% wiggle
    const start = mid > 0 ? mid * (1 - drift / 2) : 0;

    for (let i = 0; i < points; i++) {
      const tt = i / (points - 1);
      const n01 = hashTo01(`${seed}|t${i}`);
      const noise = (n01 - 0.5) * 2; // -1..1
      const value = start * (1 + drift * tt) * (1 + noise * vol);
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

  // Rent estimate (rough)
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

  // Sample comps (deterministic)
  const comps = useMemo(() => {
    const count = 4;
    const out: Array<{
      id: string;
      label: string;
      beds: string;
      size: number;
      price: number;
      ppsf: number;
      deltaPct: number;
      note: string;
    }> = [];

    const baseSize = sizeSqft > 0 ? sizeSqft : 1200;
    const basePrice = mid > 0 ? mid : 2_000_000;

    for (let i = 0; i < count; i++) {
      const r01 = hashTo01(`${seed}|comp${i}`);
      const sizeFactor = 0.9 + r01 * 0.22; // 0.90..1.12
      const priceFactor = 0.92 + hashTo01(`${seed}|p${i}`) * 0.22; // 0.92..1.14

      const s = Math.round(baseSize * sizeFactor);
      const p = Math.round(basePrice * priceFactor);
      const ppsf = s > 0 ? p / s : 0;
      const delta = ((p - basePrice) / basePrice) * 100;

      const label =
        i === 0
          ? t("result.comps.bestMatch")
          : i === 1
          ? t("result.comps.similarLayout")
          : i === 2
          ? t("result.comps.nearbyBuilding")
          : t("result.comps.recentSignal");

      out.push({
        id: `c${i}`,
        label,
        beds: beds || "—",
        size: s,
        price: p,
        ppsf,
        deltaPct: delta,
        note: t("result.comps.sampleNote"),
      });
    }

    out.sort((a, b) => Math.abs(a.size - baseSize) - Math.abs(b.size - baseSize));
    return out;
  }, [seed, beds, sizeSqft, mid, t]);

  // Market snapshot (derived)
  const market = useMemo(() => {
    const ppsf = sizeSqft > 0 && mid > 0 ? mid / sizeSqft : 0;
    const rangeWidthPct = mid > 0 ? ((maxFinal - minFinal) / mid) * 100 : 0;

    const c = (confidenceFinal || "").toLowerCase();
    const confScore = c.includes("high") ? 1 : c.includes("med") ? 0.6 : 0.35;
    const tightScore = 1 - Math.min(1, rangeWidthPct / 35);
    const activityScore = confScore * 0.6 + tightScore * 0.4;

    const activity =
      activityScore > 0.72
        ? t("result.snapshot.activityHigh")
        : activityScore > 0.5
        ? t("result.snapshot.activityMed")
        : t("result.snapshot.activityLow");

    const yoy = (hashTo01(seed + "|yoy") - 0.5) * 12; // -6..+6
    const mom = (hashTo01(seed + "|mom") - 0.5) * 4; // -2..+2
    const dom = Math.round(18 + hashTo01(seed + "|dom") * 45); // 18..63

    return { ppsf, rangeWidthPct, activity, yoy, mom, dom };
  }, [sizeSqft, mid, maxFinal, minFinal, confidenceFinal, seed, t]);

  // Confidence badge style
  const confColor = useMemo(() => {
    const c = (confidenceFinal || "").toLowerCase();
    if (c.includes("high")) return { bg: "#ecfeff", bd: "#a5f3fc", fg: "#0e7490" };
    if (c.includes("med")) return { bg: "#fef9c3", bd: "#fde68a", fg: "#92400e" };
    return { bg: "#fee2e2", bd: "#fecaca", fg: "#991b1b" };
  }, [confidenceFinal]);

  const pad = isMobile ? 14 : 18;
  const pagePad = isMobile ? "20px 14px" : "40px 16px";

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 700,
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", padding: pagePad, color: "#0f172a" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* ✅ refine result modal */}
        {refineResult && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 50,
            }}
            onClick={() => setRefineResult(null)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                padding: 16,
                boxShadow: "0 20px 60px rgba(0,0,0,.20)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 8 }}>{t("refine.modal.title")}</div>

              <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.6 }}>
                {formatAED(refineResult.min)} <span style={{ color: "#94a3b8" }}>–</span> {formatAED(refineResult.max)}
              </div>

              <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{refineResult.note}</div>

              <button
                onClick={() => setRefineResult(null)}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#0ea5e9",
                  color: "#fff",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                {t("refine.modal.done")}
              </button>
            </div>
          </div>
        )}

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
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                padding: 4,
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 950, lineHeight: 1.1 }}>UAEHomeValue</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{t("result.brandTagline")}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <a href={homeUrl} style={{ textDecoration: "none" }}>
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
                {t("result.actions.recheck")}
              </button>
            </a>

            <a href={changeInputsUrl} style={{ textDecoration: "none" }}>
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
                {t("result.actions.changeInputs")}
              </button>
            </a>
          </div>
        </div>

        {/* Header */}
        <div style={{ marginTop: 12 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 950, letterSpacing: -0.6, lineHeight: 1.12 }}>
            {t("result.title")}
          </h1>

          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{t("result.subtitle")}</div>

          <div style={{ marginTop: 6, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            {area || "—"} • {type || "—"} • {beds ? t("result.header.beds", { beds }) : "—"} • {formatSqft(sizeSqft)}{" "}
            {t("result.header.sqft")}
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.3fr 0.7fr", gap: 14, marginTop: 16 }}>
          {/* Left column */}
          <div style={{ display: "grid", gap: 14 }}>
            {/* A) Value card */}
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
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{t("result.likelyRange")}</div>

                  <div style={{ fontSize: isMobile ? 32 : 38, fontWeight: 950, letterSpacing: -1, lineHeight: 1.05 }}>
                    {formatAED(likely.likelyMin)} <span style={{ color: "#94a3b8" }}>–</span> {formatAED(likely.likelyMax)}
                  </div>

                  <div style={{ marginTop: 10, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                    {t("result.conservativeRange")}:{" "}
                    <b>
                      {formatAED(minFinal)} – {formatAED(maxFinal)}
                    </b>{" "}
                    • {t("result.likelyBandWidth")}: {pct(likely.bandPct)}
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                    {t("result.lastUpdated")} • {t("result.rangeWidth")}: {pct(band.rangePct)} • {t("result.likelyVolatility")}:{" "}
                    {pct(band.likelyPct)}
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
                    {t("result.confidence")}: {confidenceFinal}
                  </div>

                  <button
                    onClick={() => setShowRefine(true)}
                    style={{
                      border: "1px solid #0ea5e9",
                      background: "#0ea5e9",
                      color: "#fff",
                      padding: "10px 12px",
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {t("refine.open")}
                  </button>
                </div>
              </div>

              {/* Refine form */}
              {showRefine && (
                <div
                  style={{
                    marginTop: 16,
                    border: "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: 16,
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 15 }}>{t("refine.title")}</div>
                    <button
                      onClick={() => setShowRefine(false)}
                      style={{
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        padding: "6px 10px",
                        borderRadius: 10,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {t("refine.close")}
                    </button>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{t("refine.helper")}</div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <input
                      placeholder={t("refine.building")}
                      value={refineData.building}
                      onChange={(e) => setRefineData({ ...refineData, building: e.target.value })}
                      style={inputStyle}
                    />

                    <select
                      value={refineData.floor}
                      onChange={(e) => setRefineData({ ...refineData, floor: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">{t("refine.floor")}</option>
                      <option value="low">{t("refine.floorOptions.low")}</option>
                      <option value="mid">{t("refine.floorOptions.mid")}</option>
                      <option value="high">{t("refine.floorOptions.high")}</option>
                    </select>

                    <select
                      value={refineData.view}
                      onChange={(e) => setRefineData({ ...refineData, view: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">{t("refine.view")}</option>
                      <option value="sea">{t("refine.viewOptions.sea")}</option>
                      <option value="city">{t("refine.viewOptions.city")}</option>
                      <option value="road">{t("refine.viewOptions.road")}</option>
                    </select>

                    <select
                      value={refineData.condition}
                      onChange={(e) => setRefineData({ ...refineData, condition: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">{t("refine.condition")}</option>
                      <option value="original">{t("refine.conditionOptions.original")}</option>
                      <option value="good">{t("refine.conditionOptions.good")}</option>
                      <option value="upgraded">{t("refine.conditionOptions.upgraded")}</option>
                      <option value="renovated">{t("refine.conditionOptions.renovated")}</option>
                    </select>

                    <select
                      value={refineData.parking}
                      onChange={(e) => setRefineData({ ...refineData, parking: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">{t("refine.parking")}</option>
                      <option value="0">{t("refine.parkingOptions.none")}</option>
                      <option value="1">{t("refine.parkingOptions.one")}</option>
                      <option value="2">{t("refine.parkingOptions.two")}</option>
                      <option value="3+">{t("refine.parkingOptions.threePlus")}</option>
                    </select>

                    {/* Amenities */}
                    <div style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, color: "#0f172a" }}>
                        {t("refine.amenitiesTitle")}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { key: "beach", label: t("refine.amenities.beach") },
                          { key: "mall", label: t("refine.amenities.mall") },
                          { key: "metro", label: t("refine.amenities.metro") },
                          { key: "park", label: t("refine.amenities.park") },
                          { key: "schools", label: t("refine.amenities.schools") },
                          { key: "pool", label: t("refine.amenities.pool") },
                          { key: "gym", label: t("refine.amenities.gym") },
                          { key: "kids", label: t("refine.amenities.kids") },
                        ].map((a) => {
                          const checked = refineData.amenities?.includes(a.key);
                          return (
                            <label
                              key={a.key}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: checked ? "1px solid #0ea5e9" : "1px solid #e2e8f0",
                                background: checked ? "#f0f9ff" : "#fff",
                                cursor: "pointer",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={!!checked}
                                onChange={() => {
                                  setRefineData((prev) => {
                                    const list = prev.amenities || [];
                                    return {
                                      ...prev,
                                      amenities: checked ? list.filter((x) => x !== a.key) : [...list, a.key],
                                    };
                                  });
                                }}
                              />
                              {a.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <input
                      placeholder={t("refine.expectedPrice")}
                      inputMode="numeric"
                      value={refineData.expectedPrice}
                      onChange={(e) =>
                        setRefineData({ ...refineData, expectedPrice: e.target.value.replace(/[^\d]/g, "") })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <button
                    onClick={() => {
                      const lo = Number(minFinal ?? min);
                      const hi = Number(maxFinal ?? max);

                      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
                        setRefineResult({
                          min: lo || 0,
                          max: hi || 0,
                          note: t("refine.messages.notEnoughData"),
                        });
                        setShowRefine(false);
                        return;
                      }

                      const width = hi - lo;
                      const midLocal = (lo + hi) / 2;

                      const filled =
                        (refineData.building ? 1 : 0) +
                        (refineData.floor ? 1 : 0) +
                        (refineData.view ? 1 : 0) +
                        (refineData.condition ? 1 : 0) +
                        (refineData.parking ? 1 : 0) +
                        (refineData.expectedPrice ? 1 : 0) +
                        ((refineData.amenities?.length || 0) >= 2 ? 1 : 0);

                      const shrinkFactor = filled >= 5 ? 0.4 : filled >= 3 ? 0.5 : 0.65;

                      let newHalf = (width * shrinkFactor) / 2;
                      let newMin = Math.round(midLocal - newHalf);
                      let newMax = Math.round(midLocal + newHalf);

                      newMin = Math.max(lo, newMin);
                      newMax = Math.min(hi, newMax);

                      const newWidth = newMax - newMin;
                      if (newWidth >= width * 0.75) {
                        newHalf = (width * 0.74) / 2;
                        newMin = Math.max(lo, Math.round(midLocal - newHalf));
                        newMax = Math.min(hi, Math.round(midLocal + newHalf));
                      }

                      setMinOverride(newMin);
                      setMaxOverride(newMax);
                      setConfidenceOverride(t("refine.messages.refinedBadge"));

                      setRefineResult({
                        min: newMin,
                        max: newMax,
                        note: t("refine.messages.thanks"),
                      });

                      setShowRefine(false);
                    }}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      padding: "12px",
                      borderRadius: 12,
                      border: "none",
                      background: "#0ea5e9",
                      color: "#fff",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                  >
                    {t("refine.submit")}
                  </button>

                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{t("refine.note")}</div>
                </div>
              )}

              {/* B) Explanation module */}
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 14,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: "#334155",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("result.how.title")}</div>
                <div>
                  {t("result.how.desc")}
                  <br />
                  <br />
                  <b>{t("result.how.factorsTitle")}</b>
                  <ul style={{ margin: "6px 0 6px 18px" }}>
                    <li>{t("result.how.factors.location")}</li>
                    <li>{t("result.how.factors.type")}</li>
                    <li>{t("result.how.factors.size")}</li>
                    <li>{t("result.how.factors.activity")}</li>
                  </ul>
                  {t("result.how.footer")}
                </div>
              </div>

              {/* Trend + Rent row */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 14 }}>
                {/* Trend */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{t("result.trend.title")}</div>
                    <div style={{ fontSize: 12, color: trendChangePct >= 0 ? "#166534" : "#991b1b", fontWeight: 900 }}>
                      {pct(trendChangePct)}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <svg width="240" height="64" viewBox="0 0 240 64" style={{ maxWidth: "100%", height: "auto" }}>
                      <path d={trendPath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>

                    <div style={{ minWidth: 110, textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{t("result.trend.now")}</div>
                      <div style={{ fontWeight: 950 }}>{formatAedShort(trend[trend.length - 1] || mid)}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{t("result.trend.daysAgo")}</div>
                      <div style={{ fontWeight: 900, color: "#334155" }}>{formatAedShort(trend[0] || mid)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>{t("result.trend.note")}</div>
                </div>

                {/* Rent */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{t("result.rent.title")}</div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{t("result.rent.monthlyLabel")}</div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, letterSpacing: -0.4 }}>
                    {formatAedShort(rent.monthlyMin)} <span style={{ color: "#94a3b8" }}>–</span> {formatAedShort(rent.monthlyMax)}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                    {t("result.rent.annualLabel")}: {formatAedShort(rent.annualMin)} – {formatAedShort(rent.annualMax)} •{" "}
                    {t("result.rent.yieldLabel")}: {rent.yieldMinPct}–{rent.yieldMaxPct}%
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>{t("result.rent.basis")}</div>
                </div>
              </div>
            </div>

            {/* C) Comparable homes */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: pad }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: -0.3 }}>{t("result.comps.title")}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{t("result.comps.subtitle")}</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                {comps.map((c) => (
                  <div key={c.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{c.label}</div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: c.deltaPct >= 0 ? "#166534" : "#991b1b",
                          background: c.deltaPct >= 0 ? "#dcfce7" : "#fee2e2",
                          border: `1px solid ${c.deltaPct >= 0 ? "#bbf7d0" : "#fecaca"}`,
                          padding: "4px 8px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {pct(c.deltaPct)}
                      </div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                      {type || "—"} • {c.beds ? t("result.header.beds", { beds: c.beds }) : "—"} • {formatSqft(c.size)}{" "}
                      {t("result.header.sqft")}
                    </div>

                    <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950 }}>
                      {formatAedShort(c.price)}
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                        {" "}
                        • {Math.round(c.ppsf).toLocaleString("en-US")} {t("result.comps.aedPerSqft")}
                      </span>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{c.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Extra: Adjustments card */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: pad, marginTop: 2, background: "#f8fafc" }}>
              <div style={{ fontSize: 15, fontWeight: 950, marginBottom: 10 }}>{t("result.adjustmentsTitle")}</div>

              <div style={{ display: "grid", gap: 10 }}>
                {valueAdjustments(t).map((v) => (
                  <div
                    key={v.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      background: "#fff",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{v.label}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{v.note}</div>
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 950, color: "#0f172a", whiteSpace: "nowrap" }}>{v.impact}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* D) Value drivers */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: pad }}>
              <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: -0.3 }}>{t("result.drivers.title")}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>{t("result.drivers.subtitle")}</div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                {[
                  ["view", "🪟", "result.drivers.items.view"],
                  ["floor", "🏢", "result.drivers.items.floor"],
                  ["condition", "🛠", "result.drivers.items.condition"],
                  ["parking", "🚗", "result.drivers.items.parking"],
                ].map(([key, icon, baseKey]) => (
                  <div key={key} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>
                        {icon} {t(`${baseKey}.title`)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#0f172a",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          padding: "4px 8px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t(`${baseKey}.band`)}
                      </div>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{t(`${baseKey}.desc`)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "grid", gap: 14 }}>
            {/* E) MAP CARD */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: pad, borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 14 }}>{t("result.map.title")}</div>
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
                      {t("result.map.open")}
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

            {/* MARKET SNAPSHOT */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: pad, background: "#fafafa" }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{t("result.snapshot.title")}</div>

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  [t("result.snapshot.medianValue"), formatAedShort(mid)],
                  [
                    t("result.snapshot.pricePerSqft"),
                    market.ppsf > 0
                      ? `${Math.round(market.ppsf).toLocaleString("en-US")} ${t("result.comps.aedPerSqft")}`
                      : "—",
                  ],
                  [t("result.snapshot.activity"), market.activity],
                  [t("result.snapshot.daysOnMarket"), t("result.snapshot.daysOnMarketValue", { days: market.dom })],
                  [t("result.snapshot.mom"), pct(market.mom)],
                  [t("result.snapshot.yoy"), pct(market.yoy)],
                ].map(([k, v]) => (
                  <div
                    key={String(k)}
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

              <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>{t("result.snapshot.note")}</div>
            </div>

            {/* INPUTS */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: pad }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{t("result.inputs.title")}</div>

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  [t("result.inputs.area"), area || "—"],
                  [t("result.inputs.type"), type || "—"],
                  [t("result.inputs.bedrooms"), beds || "—"],
                  [t("result.inputs.size"), formatSqft(sizeSqft)],
                  [t("result.inputs.parking"), refineData?.parking ? refineData.parking : "—"],
                ].map(([k, v]) => (
                  <div
                    key={String(k)}
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
                    <div style={{ fontWeight: 900, textAlign: "right" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ fontSize: 12, color: "#94a3b8", padding: "0 4px" }}>{t("result.disclaimer")}</div>
          </div>
        </div>

        {/* Help card */}
        <div
          style={{
            marginTop: 28,
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 16,
            background: "#f8fafc",
            display: "grid",
            gap: 10,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 950 }}>{t("help.title")}</div>

          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{t("help.desc")}</div>

          <a href="https://wa.me/971581188247" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button
              style={{
                border: "1px solid #0ea5e9",
                background: "#0ea5e9",
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {t("help.button")}
            </button>
          </a>

          <div style={{ fontSize: 12, color: "#64748b" }}>{t("help.tip")}</div>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>{t("footer.copy")}</div>
      </div>
    </div>
  );
}