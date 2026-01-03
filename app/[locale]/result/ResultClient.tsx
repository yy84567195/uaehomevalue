"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import styles from "./ResultClient.module.css";
import { formatAED } from "@/lib/estimator";
import FooterBrand from "../components/FooterBrand";

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
    { label: t("result.adjustments.seaView.label"), impact: t("result.adjustments.seaView.impact"), note: t("result.adjustments.seaView.note") },
    { label: t("result.adjustments.highFloor.label"), impact: t("result.adjustments.highFloor.impact"), note: t("result.adjustments.highFloor.note") },
    { label: t("result.adjustments.upgraded.label"), impact: t("result.adjustments.upgraded.impact"), note: t("result.adjustments.upgraded.note") },
    { label: t("result.adjustments.lowFloorRoad.label"), impact: t("result.adjustments.lowFloorRoad.impact"), note: t("result.adjustments.lowFloorRoad.note") },
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
const [showMap, setShowMap] = useState(false);

useEffect(() => {
  const el = document.getElementById("map-anchor");
  if (!el) return;

  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        setShowMap(true);
        io.disconnect();
      }
    },
    { rootMargin: "300px" }
  );

  io.observe(el);
  return () => io.disconnect();
}, []);
  const [refineResult, setRefineResult] = useState<null | { min: number; max: number; note: string }>(null);

  const [minOverride, setMinOverride] = useState<number | null>(null);
  const [maxOverride, setMaxOverride] = useState<number | null>(null);
  const [confidenceOverride, setConfidenceOverride] = useState<string | null>(null);


  // URL params
  const area = useMemo(() => getParam("area"), []);
  const community = useMemo(() => getParam("community"), []);
  const building = useMemo(() => getParam("building"), []);
  const type = useMemo(() => getParam("type"), []);
  const beds = useMemo(() => getParam("beds"), []);
  const bedsLabel = useMemo(() => {
    const b = Number(beds);
    if (!Number.isFinite(b)) return "";
    if (b === 0) return "Studio";
    if (b >= 4) return "4+";
    return String(b);
  }, [beds]);

  const sizeSqftStr = useMemo(() => getParam("sizeSqft"), []);
  const min = useMemo(() => Number(getParam("min") || 0), []);
  const max = useMemo(() => Number(getParam("max") || 0), []);
  const confidence = useMemo(() => getParam("confidence") || "Medium", []);
  const matched = useMemo(() => getParam("matched"), []);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  // ✅ refine override 优先
  const minFinal = minOverride ?? min;
  const maxFinal = maxOverride ?? max;
  const confidenceFinal = confidenceOverride ?? confidence;

  const bedsNum = useMemo(() => Number(beds || 0), [beds]);
  const sizeSqft = useMemo(() => Number(sizeSqftStr || 0), [sizeSqftStr]);

  const shareText = [
    `UAEHomeValue estimate: ${formatAedShort(minFinal)}–${formatAedShort(maxFinal)}`,
    community ? `Community: ${community}${matched === "community" ? " ✓" : ""}` : null,
    `Area: ${area || "—"}`,
    type ? `Type: ${type}` : null,
    bedsNum ? `Beds: ${bedsNum}` : null,
    sizeSqft ? `Size: ${formatSqft(sizeSqft)} sqft` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const shareMessage = `${shareText}\n${shareUrl}`;
  const [copied, setCopied] = useState(false);

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy link:", shareUrl);
    }
  }

  function onShareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function onShareTelegram() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
async function submitLeadFromResult(extra?: { source?: string; notes?: string }) {
  try {
    await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // 结果页没有姓名/whatsapp输入就先留空
        name: "",
        whatsapp: "",
        notes: extra?.notes || "",

        area,
        community,
        type,
        beds: Number(bedsNum || 0),
        sizeSqft: Number(sizeSqft || 0),

        estimateMin: Number(minFinal || 0),
        estimateMax: Number(maxFinal || 0),

        // 可选：告诉你是从哪个按钮提交的（你后端不存也没关系）
        source: extra?.source || "result",
      }),
    });
  } catch (e) {
    console.error("lead submit failed (result)", e);
  }
}
  const mid = useMemo(() => (minFinal + maxFinal) / 2 || 0, [minFinal, maxFinal]);

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

  const seed = useMemo(
    () => `${area}|${type}|${beds}|${sizeSqftStr}|${minFinal}|${maxFinal}`,
    [area, type, beds, sizeSqftStr, minFinal, maxFinal]
  );

  const base01 = useMemo(() => hashTo01(seed), [seed]);

  const trend = useMemo(() => {
    const points = 12;
    const out: number[] = [];
    const drift = (base01 - 0.5) * 0.06; // -3%..+3%
    const vol = 0.012 + base01 * 0.01; // 1.2%..2.2%
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

  const comps = useMemo(() => {
    const count = 4;
    const out: Array<{ id: string; label: string; beds: string; size: number; price: number; ppsf: number; deltaPct: number; note: string }> = [];

    const baseSize = sizeSqft > 0 ? sizeSqft : 1200;
    const basePrice = mid > 0 ? mid : 2_000_000;

    for (let i = 0; i < count; i++) {
      const r01 = hashTo01(`${seed}|comp${i}`);
      const sizeFactor = 0.9 + r01 * 0.22;
      const priceFactor = 0.92 + hashTo01(`${seed}|p${i}`) * 0.22;

      const s = Math.round(baseSize * sizeFactor);
      const p = Math.round(basePrice * priceFactor);
      const ppsf = s > 0 ? p / s : 0;
      const delta = ((p - basePrice) / basePrice) * 100;

      const label =
        i === 0 ? t("result.comps.bestMatch") :
        i === 1 ? t("result.comps.similarLayout") :
        i === 2 ? t("result.comps.nearbyBuilding") :
        t("result.comps.recentSignal");

      out.push({ id: `c${i}`, label, beds: beds || "—", size: s, price: p, ppsf, deltaPct: delta, note: t("result.comps.sampleNote") });
    }

    out.sort((a, b) => Math.abs(a.size - baseSize) - Math.abs(b.size - baseSize));
    return out;
  }, [seed, beds, sizeSqft, mid, t]);

  const market = useMemo(() => {
    const ppsf = sizeSqft > 0 && mid > 0 ? mid / sizeSqft : 0;
    const rangeWidthPct = mid > 0 ? ((maxFinal - minFinal) / mid) * 100 : 0;

    const c = (confidenceFinal || "").toLowerCase();
    const confScore = c.includes("high") ? 1 : c.includes("med") ? 0.6 : 0.35;
    const tightScore = 1 - Math.min(1, rangeWidthPct / 35);
    const activityScore = confScore * 0.6 + tightScore * 0.4;

    const activity =
      activityScore > 0.72 ? t("result.snapshot.activityHigh") :
      activityScore > 0.5 ? t("result.snapshot.activityMed") :
      t("result.snapshot.activityLow");

    const yoy = (hashTo01(seed + "|yoy") - 0.5) * 12;
    const mom = (hashTo01(seed + "|mom") - 0.5) * 4;
    const dom = Math.round(18 + hashTo01(seed + "|dom") * 45);

    return { ppsf, rangeWidthPct, activity, yoy, mom, dom };
  }, [sizeSqft, mid, maxFinal, minFinal, confidenceFinal, seed, t]);

  // (保留你原本的颜色逻辑，但用“暗色可读”的值)
  const confTone = useMemo(() => {
    const c = (confidenceFinal || "").toLowerCase();
    if (c.includes("high")) return { cls: styles.pillPos };
    if (c.includes("med")) return { cls: styles.badge };
    return { cls: styles.pillNeg };
  }, [confidenceFinal]);

  // input style（保留少量 inline，避免再建很多 class；也可以以后继续 module 化）
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.04)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 700,
    outline: "none",
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {/* ✅ refine result modal（保留，但改暗色遮罩/卡片） */}
        {refineResult && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 50,
            }}
            onClick={() => setRefineResult(null)}
          >
            <div
              className={`${styles.card} ${styles.cardPad}`}
              style={{ width: "100%", maxWidth: 460 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 8 }}>{t("refine.modal.title")}</div>
              <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.6 }}>
                {formatAED(refineResult.min)} <span style={{ color: "var(--text-muted)" }}>–</span> {formatAED(refineResult.max)}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{refineResult.note}</div>
              <button className={styles.btnPrimary} style={{ marginTop: 12 }} onClick={() => setRefineResult(null)}>
                {t("refine.modal.done")}
              </button>
            </div>
          </div>
        )}

{/* Header row (title left + actions right) */}
<div className={styles.headerRow}>
  <div className={styles.headerLeft}>
    <h1 className={styles.h1}>{t("result.title")}</h1>
    <div className={styles.sub}>{t("result.subtitle")}</div>

    <div className={styles.metaLine}>
      {area || "—"} • {type || "—"} •{" "}
      {bedsLabel
        ? bedsLabel === "Studio"
          ? t("result.header.studio")
          : bedsLabel === "4+"
          ? t("result.header.bedsPlus")
          : t("result.header.beds", { beds: bedsLabel })
        : "—"}{" "}
      • {formatSqft(sizeSqft)} {t("result.header.sqft")}
    </div>
  </div>

  <div className={styles.actions}>
    <a href={homeUrl}>
      <button className={styles.btnGhost}>{t("result.actions.recheck")}</button>
    </a>
    <a href={changeInputsUrl}>
      <button className={styles.btnOutline}>{t("result.actions.changeInputs")}</button>
    </a>
  </div>
</div>
        {/* Main layout */}
        <div className={styles.mainGrid}>
          {/* Left column */}
          <div className={styles.col}>
            {/* A) Value card */}
            <div className={`${styles.card} ${styles.cardPad} ${styles.cardHover}`}>
              <div className={styles.kpiTop}>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.kpiLabel}>{t("result.likelyRange")}</div>
                  <div className={styles.kpiVal}>
                    {formatAED(likely.likelyMin)} <span style={{ color: "var(--text-muted)" }}>–</span> {formatAED(likely.likelyMax)}
                  </div>

                  <div className={styles.kpiNote}>
                    {t("result.conservativeRange")}: <b>{formatAED(minFinal)} – {formatAED(maxFinal)}</b> • {t("result.likelyBandWidth")}: {pct(likely.bandPct)}
                  </div>

                  <div className={styles.kpiTiny}>
                    {t("result.lastUpdated")} • {t("result.rangeWidth")}: {pct(band.rangePct)} • {t("result.likelyVolatility")}: {pct(band.likelyPct)}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10, minWidth: 220 }}>
                  <div className={confTone.cls}>
                    {t("result.confidence")}: {confidenceFinal}
                  </div>

                  <button className={styles.btnPrimary} onClick={() => setShowRefine(true)}>
                    {t("refine.open")}
                  </button>
                </div>
              </div>

              {/* Refine form（保留功能，外观改成暗色 softCard） */}
              {showRefine && (
                <div style={{ marginTop: 16 }} className={styles.softCard}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 15 }}>{t("refine.title")}</div>
                    <button className={styles.btnGhost} onClick={() => setShowRefine(false)} style={{ padding: "6px 10px" }}>
                      {t("refine.close")}
                    </button>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{t("refine.helper")}</div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <input placeholder={t("refine.building")} value={refineData.building} onChange={(e) => setRefineData({ ...refineData, building: e.target.value })} style={inputStyle} />

                    <select value={refineData.floor} onChange={(e) => setRefineData({ ...refineData, floor: e.target.value })} style={inputStyle}>
                      <option value="">{t("refine.floor")}</option>
                      <option value="low">{t("refine.floorOptions.low")}</option>
                      <option value="mid">{t("refine.floorOptions.mid")}</option>
                      <option value="high">{t("refine.floorOptions.high")}</option>
                    </select>

                    <select value={refineData.view} onChange={(e) => setRefineData({ ...refineData, view: e.target.value })} style={inputStyle}>
                      <option value="">{t("refine.view")}</option>
                      <option value="sea">{t("refine.viewOptions.sea")}</option>
                      <option value="city">{t("refine.viewOptions.city")}</option>
                      <option value="road">{t("refine.viewOptions.road")}</option>
                    </select>

                    <select value={refineData.condition} onChange={(e) => setRefineData({ ...refineData, condition: e.target.value })} style={inputStyle}>
                      <option value="">{t("refine.condition")}</option>
                      <option value="original">{t("refine.conditionOptions.original")}</option>
                      <option value="good">{t("refine.conditionOptions.good")}</option>
                      <option value="upgraded">{t("refine.conditionOptions.upgraded")}</option>
                      <option value="renovated">{t("refine.conditionOptions.renovated")}</option>
                    </select>

                    <select value={refineData.parking} onChange={(e) => setRefineData({ ...refineData, parking: e.target.value })} style={inputStyle}>
                      <option value="">{t("refine.parking")}</option>
                      <option value="0">{t("refine.parkingOptions.none")}</option>
                      <option value="1">{t("refine.parkingOptions.one")}</option>
                      <option value="2">{t("refine.parkingOptions.two")}</option>
                      <option value="3+">{t("refine.parkingOptions.threePlus")}</option>
                    </select>

                    {/* Amenities（保留你原逻辑，样式稍后你要更“科技”我再给你升级） */}
                    <div style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,.04)", borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, color: "var(--text)" }}>
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
                                border: checked ? "1px solid rgba(88,166,255,.55)" : "1px solid var(--border)",
                                background: checked ? "rgba(88,166,255,.14)" : "rgba(255,255,255,.04)",
                                cursor: "pointer",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--text)",
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
                      onChange={(e) => setRefineData({ ...refineData, expectedPrice: e.target.value.replace(/[^\d]/g, "") })}
                      style={inputStyle}
                    />
                  </div>

                  <button
                    className={styles.btnPrimary}
                    style={{ marginTop: 12 }}
                    onClick={async () => {
                      const lo = Number(minFinal ?? min);
                      const hi = Number(maxFinal ?? max);

                      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
                        setRefineResult({ min: lo || 0, max: hi || 0, note: t("refine.messages.notEnoughData") });
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

// ✅ 结果页也发一封邮件（不影响用户流程）
submitLeadFromResult({
  source: "result_refine_submit",
  notes:
    `Refine submit` +
    ` | building=${refineData.building || "-"}` +
    ` | floor=${refineData.floor || "-"}` +
    ` | view=${refineData.view || "-"}` +
    ` | condition=${refineData.condition || "-"}` +
    ` | parking=${refineData.parking || "-"}` +
    ` | expectedPrice=${refineData.expectedPrice || "-"}` +
    ` | amenities=${(refineData.amenities && refineData.amenities.length ? refineData.amenities.join(",") : "-")}` +
    ` | refinedRange=${newMin}-${newMax}`,
});

// ✅ send lead email (refine) - do NOT block user flow
try {
  await fetch("/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "",
      whatsapp: "",
      notes:
        `Refine submit` +
        ` | building=${refineData.building || "-"}` +
        ` | floor=${refineData.floor || "-"}` +
        ` | view=${refineData.view || "-"}` +
        ` | condition=${refineData.condition || "-"}` +
        ` | parking=${refineData.parking || "-"}` +
        ` | expectedPrice=${refineData.expectedPrice || "-"}` +
        ` | amenities=${(refineData.amenities?.length ? refineData.amenities.join(",") : "-")}` +
        ` | refinedRange=${newMin}-${newMax}`,
      area,
      community: String(community || ""),
      type,
      beds: Number(beds || 0),
      sizeSqft: Number(sizeSqftStr || 0),
      estimateMin: newMin,
      estimateMax: newMax,
    }),
  });
} catch (e) {
  console.error("refine lead submit failed", e);
}

// ✅ UI 结果（保持你原来的）
setRefineResult({ min: newMin, max: newMax, note: t("refine.messages.thanks") });
setShowRefine(false);
                    }}
                  >
                    {t("refine.submit")}
                  </button>

                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>{t("refine.note")}</div>
                </div>
              )}

              {/* How it’s calculated + match badge */}
              <div style={{ marginTop: 16 }} className={styles.softCard}>
                <div className={styles.softTitle}>{t("result.how.title")}</div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                  {t("result.how.desc")}
                  <br /><br />
                  <b>{t("result.how.factorsTitle")}</b>
                  <ul style={{ margin: "6px 0 6px 18px" }}>
                    <li>{t("result.how.factors.location")}</li>
                    <li>{t("result.how.factors.type")}</li>
                    <li>{t("result.how.factors.size")}</li>
                    <li>{t("result.how.factors.activity")}</li>
                  </ul>
                  {t("result.how.footer")}
                </div>

                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {community ? (
                    matched === "community" ? (
                      <div className={styles.pillPos}>
                        ✓ {t("result.how.communityMatch")}
                      </div>
                    ) : (
                      <div className={styles.badge}>
                        ⚠︎ {t("result.how.areaMatch")}
                      </div>
                    )
                  ) : (
                    <div className={styles.badge}>
                      ℹ︎ {t("home.community")} · {t("home.communityAll")}
                    </div>
                  )}
                </div>
              </div>

              {/* Trend + Rent */}
              <div className={styles.rowCards} style={{ marginTop: 14 }}>
                <div className={`${styles.card} ${styles.cardPad}`}>
                  <div className={styles.miniTop}>
                    <div className={styles.miniTitle}>{t("result.trend.title")}</div>
                    <div className={trendChangePct >= 0 ? styles.pillPos : styles.pillNeg}>{pct(trendChangePct)}</div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <svg width="240" height="64" viewBox="0 0 240 64" style={{ maxWidth: "100%", height: "auto" }}>
                      <path d={trendPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>

                    <div style={{ minWidth: 110, textAlign: "right" }}>
                      <div className={styles.k}>{t("result.trend.now")}</div>
                      <div style={{ fontWeight: 950 }}>{formatAedShort(trend[trend.length - 1] || mid)}</div>
                      <div className={styles.k} style={{ marginTop: 6 }}>{t("result.trend.daysAgo")}</div>
                      <div style={{ fontWeight: 900, color: "var(--text-secondary)" }}>{formatAedShort(trend[0] || mid)}</div>
                    </div>
                  </div>

                  <div className={styles.miniSub}>{t("result.trend.note")}</div>
                </div>

                <div className={`${styles.card} ${styles.cardPad}`}>
                  <div className={styles.miniTitle}>{t("result.rent.title")}</div>
                  <div className={styles.k} style={{ marginTop: 8 }}>{t("result.rent.monthlyLabel")}</div>
                  <div style={{ marginTop: 6, fontSize: 20, fontWeight: 950, letterSpacing: -0.4 }}>
                    {formatAedShort(rent.monthlyMin)} <span style={{ color: "var(--text-muted)" }}>–</span> {formatAedShort(rent.monthlyMax)}
                  </div>
                  <div className={styles.miniSub} style={{ marginTop: 8 }}>
                    {t("result.rent.annualLabel")}: {formatAedShort(rent.annualMin)} – {formatAedShort(rent.annualMax)} • {t("result.rent.yieldLabel")}: {rent.yieldMinPct}–{rent.yieldMaxPct}%
                  </div>
                  <div className={styles.miniSub} style={{ marginTop: 10 }}>{t("result.rent.basis")}</div>
                </div>
              </div>
            </div>

            {/* C) Comps */}
            <div className={`${styles.card} ${styles.cardPad} ${styles.cardHover}`}>
              <div className={styles.miniTop}>
                <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: -0.3 }}>{t("result.comps.title")}</div>
                <div className={styles.k}>{t("result.comps.subtitle")}</div>
              </div>

              <div className={styles.list2} style={{ marginTop: 10 }}>
                {comps.map((c) => (
                  <div key={c.id} className={styles.miniCard}>
                    <div className={styles.miniTop}>
                      <div className={styles.miniTitle}>{c.label}</div>
                      <div className={c.deltaPct >= 0 ? styles.pillPos : styles.pillNeg}>{pct(c.deltaPct)}</div>
                    </div>

                    <div className={styles.miniSub}>
                      {type || "—"} • {c.beds ? t("result.header.beds", { beds: c.beds }) : "—"} • {formatSqft(c.size)} {t("result.header.sqft")}
                    </div>

                    <div className={styles.miniPrice}>
                      {formatAedShort(c.price)}
                      <span className={styles.k} style={{ fontWeight: 700 }}>
                        {" "}• {Math.round(c.ppsf).toLocaleString("en-US")} {t("result.comps.aedPerSqft")}
                      </span>
                    </div>

                    <div className={styles.miniSub}>{c.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Adjustments */}
            <div className={`${styles.card} ${styles.cardPad} ${styles.cardHover}`}>
              <div style={{ fontSize: 15, fontWeight: 950, marginBottom: 10 }}>{t("result.adjustmentsTitle")}</div>
              <div style={{ display: "grid", gap: 10 }}>
                {valueAdjustments(t).map((v) => (
                  <div key={v.label} className={styles.inputRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>{v.label}</div>
                      <div className={styles.k} style={{ marginTop: 4 }}>{v.note}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" }}>{v.impact}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Value drivers */}
            <div className={`${styles.card} ${styles.cardPad} ${styles.cardHover}`}>
              <div style={{ fontSize: 16, fontWeight: 950, letterSpacing: -0.3 }}>{t("result.drivers.title")}</div>
              <div className={styles.k} style={{ marginTop: 8 }}>{t("result.drivers.subtitle")}</div>

              <div className={styles.list2} style={{ marginTop: 10 }}>
                {[
                  ["view", "🪟", "result.drivers.items.view"],
                  ["floor", "🏢", "result.drivers.items.floor"],
                  ["condition", "🛠", "result.drivers.items.condition"],
                  ["parking", "🚗", "result.drivers.items.parking"],
                ].map(([key, icon, baseKey]) => (
                  <div key={String(key)} className={styles.miniCard}>
                    <div className={styles.miniTop}>
                      <div className={styles.miniTitle}>
                        {icon} {t(`${baseKey}.title`)}
                      </div>
                      <div className={styles.badge}>{t(`${baseKey}.band`)}</div>
                    </div>
                    <div className={styles.miniSub}>{t(`${baseKey}.desc`)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className={styles.col}>
{/* Map */}
<div className={`${styles.card} ${styles.cardHover}`} style={{ overflow: "hidden" }}>
  <div className={styles.cardPad}>
    <div className={styles.miniTop}>
      <div>
        <div style={{ fontWeight: 950, fontSize: 14 }}>
          {t("result.map.title")}
        </div>
        <div className={styles.k}>
          {(community || area || "Dubai")}, UAE
        </div>
      </div>

      <button
        type="button"
        className={styles.btnGhost}
        onClick={() => {
          const q = `${community || area || "Dubai"} UAE`;
          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}&hl=en`;
          window.open(url, "_blank", "noopener,noreferrer");
        }}
      >
        {t("result.map.open")}
      </button>
    </div>

    <div className={styles.k} style={{ marginTop: 10 }}>
      {community
        ? "Tip: Tap Open to view this community on Google Maps."
        : "Tip: Tap Open to view this area on Google Maps."}
    </div>
  </div>

  {/* 👇👇👇 新增这行 anchor */}
  <div id="map-anchor" />

  {/* 👇👇👇 延迟加载 iframe */}
  {showMap ? (
    <iframe
      title="Map"
      className={styles.mapFrame}
      src={`https://www.google.com/maps?q=${encodeURIComponent(
        `${community || area || "Dubai"} UAE`
      )}&output=embed&hl=en`}
      height={260}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  ) : (
    <div style={{ height: 260 }} />
  )}
</div>

            {/* Market snapshot */}
            <div className={`${styles.card} ${styles.cardPad} ${styles.cardHover}`}>
              <div className={styles.k} style={{ marginBottom: 10 }}>{t("result.snapshot.title")}</div>

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  [t("result.snapshot.medianValue"), formatAedShort(mid)],
                  [
                    t("result.snapshot.pricePerSqft"),
                    market.ppsf > 0 ? `${Math.round(market.ppsf).toLocaleString("en-US")} ${t("result.comps.aedPerSqft")}` : "—",
                  ],
                  [t("result.snapshot.activity"), market.activity],
                  [t("result.snapshot.daysOnMarket"), t("result.snapshot.daysOnMarketValue", { days: market.dom })],
                  [t("result.snapshot.mom"), pct(market.mom)],
                  [t("result.snapshot.yoy"), pct(market.yoy)],
                ].map(([k, v]) => (
                  <div key={String(k)} className={styles.inputRow}>
                    <div className={styles.k}>{k}</div>
                    <div style={{ fontWeight: 950, textAlign: "right" }}>{v}</div>
                  </div>
                ))}
              </div>

              <div className={styles.k} style={{ marginTop: 10 }}>{t("result.snapshot.note")}</div>
            </div>

            {/* Inputs */}
            <div className={`${styles.card} ${styles.cardPad} ${styles.cardHover}`}>
              <div className={styles.k} style={{ marginBottom: 10 }}>{t("result.inputs.title")}</div>

              <div style={{ display: "grid", gap: 10 }}>
                {[
                  [t("result.inputs.area"), area || "—"],
                  ...(community ? [[t("home.community"), matched === "community" ? `${community} ✓` : community]] : []),
                  [t("result.inputs.type"), type || "—"],
                  [t("result.inputs.bedrooms"), beds || "—"],
                  [t("result.inputs.size"), formatSqft(sizeSqft)],
                  [t("result.inputs.parking"), refineData?.parking ? refineData.parking : "—"],
                ].map(([k, v]) => (
                  <div key={String(k)} className={styles.inputRow}>
                    <div className={styles.k}>{k}</div>
                    <div className={styles.v}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.k}>{t("result.disclaimer")}</div>
          </div>
        </div>

        {/* Share */}
        <div className={styles.shareBox}>
          <div className={styles.shareTitle}>{t("result.share.title") ?? "Share this estimate"}</div>

          <div className={styles.shareBtns}>
            <button type="button" onClick={onShareWhatsApp} className={styles.btnWA}>WhatsApp</button>
            <button type="button" onClick={onShareTelegram} className={styles.btnTG}>Telegram</button>
            <button type="button" onClick={onCopyLink} className={styles.btnCopy}>
              {copied ? (t("result.share.copied") ?? "Copied ✓") : (t("result.share.copy") ?? "Copy link")}
            </button>
          </div>

          <div className={styles.shareTip}>{t("result.share.tip")}</div>
        </div>

        {/* Help card */}
        <div className={styles.helpCard}>
          <div style={{ fontSize: 14, fontWeight: 950 }}>{t("help.title")}</div>
          <div className={styles.k} style={{ lineHeight: 1.6 }}>{t("help.desc")}</div>

          <a href="https://wa.me/971581188247" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button className={styles.btnPrimary}>{t("help.button")}</button>
          </a>

          <div className={styles.k}>{t("help.tip")}</div>
        </div>

        <div className={styles.footerBrand}>
  <img src="/logo.png" alt="UAEHomeValue" className={styles.footerLogo} />
  <div>
    <div className={styles.footerTitle}>UAEHomeValue</div>
    <div className={styles.footerCopy}>
      <div className={styles.footerCopy}>
  Track your Dubai property value growth — anytime, anywhere   © {new Date().getFullYear()} UAEHomeValue
</div>
    </div>
  </div>
</div>
      </div>
    </div>
  );
}