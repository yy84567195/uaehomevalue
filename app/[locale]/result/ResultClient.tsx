"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import styles from "./ResultClient.module.css";
import { formatAED } from "@/lib/estimator";
import { getLocaleName, getLocaleNameWithEnglish } from "@/data/area-names";
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

  // Subscribe state
  const [subEmail, setSubEmail] = useState("");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subErrKey, setSubErrKey] = useState("errorFailed");

  // Report download
  const [reportLoading, setReportLoading] = useState(false);

  // Feedback state
  const [fbOpen, setFbOpen] = useState(false);
  const [fbMsg, setFbMsg] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbStatus, setFbStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function onSubmitFeedback() {
    if (fbMsg.trim().length < 3) return;
    setFbStatus("loading");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: fbMsg, email: fbEmail, page: typeof window !== "undefined" ? window.location.href : "" }),
      });
      if (res.ok) { setFbStatus("success"); setFbMsg(""); }
      else setFbStatus("error");
    } catch { setFbStatus("error"); }
  }

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
  const fallbackLevel = useMemo(() => getParam("fallback") || "exact", []);

  const localType = useMemo(() => {
    if (type === "Apartment") return t("home.typeOptions.apartment");
    if (type === "Villa") return t("home.typeOptions.villa");
    return type || "—";
  }, [type, t]);

  const localBeds = useMemo(() => {
    if (bedsLabel === "Studio") return t("result.header.studio");
    if (bedsLabel === "4+") return t("result.header.bedsPlus");
    if (bedsLabel) return t("result.header.beds", { beds: bedsLabel });
    return "—";
  }, [bedsLabel, t]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  // ✅ refine override 优先
  const minFinal = minOverride ?? min;
  const maxFinal = maxOverride ?? max;
  const confidenceFinal = confidenceOverride ?? confidence;

  const localConfidence = useMemo(() => {
    const c = (confidenceFinal || "").toLowerCase();
    if (c.includes("high")) return t("result.snapshot.activityHigh");
    if (c.includes("med")) return t("result.snapshot.activityMed");
    if (c.includes("low")) return t("result.snapshot.activityLow");
    if (c.includes("refin")) return t("refine.messages.refinedBadge");
    return confidenceFinal;
  }, [confidenceFinal, t]);

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

  async function onSubscribe() {
    const email = subEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubErrKey("errorInvalid");
      setSubStatus("error");
      return;
    }
    setSubStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (res.ok) {
        setSubStatus("success");
      } else {
        setSubErrKey("errorFailed");
        setSubStatus("error");
      }
    } catch {
      setSubErrKey("errorFailed");
      setSubStatus("error");
    }
  }

  async function onShareReport() {
    setReportLoading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const el = document.getElementById("share-poster") as HTMLElement;
      if (!el) return;
      el.style.display = "block";
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
      el.style.display = "none";
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `UAEHomeValue_${area.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Poster generation failed:", e);
    } finally {
      setReportLoading(false);
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

  const rentMinParam = useMemo(() => Number(getParam("rent_min") || 0), []);
  const rentMaxParam = useMemo(() => Number(getParam("rent_max") || 0), []);

  const rent = useMemo(() => {
    const annMin = rentMinParam > 0 ? rentMinParam : Math.round(mid * 0.05);
    const annMax = rentMaxParam > 0 ? rentMaxParam : Math.round(mid * 0.07);
    const yieldMinPct = mid > 0 ? Math.round((annMin / mid) * 1000) / 10 : 0;
    const yieldMaxPct = mid > 0 ? Math.round((annMax / mid) * 1000) / 10 : 0;
    return {
      monthlyMin: Math.round(annMin / 12),
      monthlyMax: Math.round(annMax / 12),
      annualMin: annMin,
      annualMax: annMax,
      yieldMinPct,
      yieldMaxPct,
    };
  }, [mid, rentMinParam, rentMaxParam]);

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
      {/* Share poster — hidden, rendered by html2canvas */}
      <div id="share-poster" style={{ display: "none", position: "fixed", left: "-9999px", top: 0, width: 440, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)", borderRadius: 20, padding: "28px 24px 20px", color: "#fff" }}>
          {/* Brand header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900 }}>U</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.5px" }}>UAEHomeValue</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>{t("report.reportSubtitle")}</div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,.5)" }}>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
          </div>

          {/* Value highlight */}
          <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 14, padding: "18px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{t("result.title")}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#60a5fa", lineHeight: 1.2 }}>
              {formatAED(likely.likelyMin)} – {formatAED(likely.likelyMax)}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 6 }}>
              {t("result.conservativeRange")}: {formatAED(minFinal)} – {formatAED(maxFinal)}
            </div>
          </div>

          {/* Property info row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              [t("result.inputs.area"), getLocaleName(area, locale)],
              [t("result.inputs.type"), localType],
              ...(community ? [[t("result.inputs.community"), getLocaleNameWithEnglish(community, locale)]] : []),
              [t("result.inputs.bedrooms"), localBeds],
              [t("result.inputs.size"), `${formatSqft(sizeSqft)} ${t("result.header.sqft")}`],
              [t("result.confidence"), localConfidence],
            ].map(([k, v], i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.05)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.45)", fontWeight: 700, marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Rental yield bar */}
          <div style={{ background: "rgba(96,165,250,.12)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, border: "1px solid rgba(96,165,250,.2)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", marginBottom: 4 }}>{t("result.rent.title")}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>
              {formatAedShort(rent.monthlyMin)} – {formatAedShort(rent.monthlyMax)} / {t("result.rent.monthlyLabel").split("(")[0].trim().split(" ").pop()}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
              {t("result.rent.yieldLabel")}: {rent.yieldMinPct}% – {rent.yieldMaxPct}%
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", lineHeight: 1.5 }}>
              {t("footer.dataCredit")}<br />uaehomevalue.com
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)" }}>{t("report.reportDisclaimer").slice(0, 40)}…</div>
          </div>
        </div>
      </div>

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
      {getLocaleName(area, locale) || "—"} • {localType} • {localBeds} • {formatSqft(sizeSqft)} {t("result.header.sqft")}
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
        {/* Fallback banner */}
        {fallbackLevel !== "exact" && (
          <div className={styles.fallbackBanner} data-level={fallbackLevel}>
            <span className={styles.fallbackIcon}>{fallbackLevel === "area" ? "ℹ️" : "⚠️"}</span>
            <span>{t(`result.fallback.${fallbackLevel}`)}</span>
          </div>
        )}

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
                    {t("result.confidence")}: {localConfidence}
                  </div>

                  <button className={styles.refineBtn} onClick={() => setShowRefine(true)}>
                    <span style={{ fontSize: 15 }}>🎯</span> {t("refine.open")}
                  </button>

                  <button className={styles.btnOutline} onClick={onShareReport} disabled={reportLoading} style={{ fontSize: 13 }}>
                    {reportLoading ? t("report.downloading") : t("report.share")}
                  </button>
                </div>
              </div>

              {/* Refine CTA banner */}
              {!showRefine && (
                <div className={styles.refineCta} onClick={() => setShowRefine(true)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🎯</span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 14 }}>{t("refine.title")}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{t("refine.helper")}</div>
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}

              {/* Refine form */}
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

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, color: "var(--text)" }}>{t("refine.floor")}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[{v:"low",l:t("refine.floorOptions.low")},{v:"mid",l:t("refine.floorOptions.mid")},{v:"high",l:t("refine.floorOptions.high")}].map(({v,l}) => (
                          <button key={v} type="button" className={`${styles.chipBtn} ${refineData.floor===v?styles.chipBtnActive:""}`}
                            onClick={() => setRefineData({...refineData, floor: refineData.floor===v?"":v})}>{l}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, color: "var(--text)" }}>{t("refine.view")}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[{v:"sea",l:t("refine.viewOptions.sea")},{v:"city",l:t("refine.viewOptions.city")},{v:"road",l:t("refine.viewOptions.road")}].map(({v,l}) => (
                          <button key={v} type="button" className={`${styles.chipBtn} ${refineData.view===v?styles.chipBtnActive:""}`}
                            onClick={() => setRefineData({...refineData, view: refineData.view===v?"":v})}>{l}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, color: "var(--text)" }}>{t("refine.condition")}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[{v:"original",l:t("refine.conditionOptions.original")},{v:"good",l:t("refine.conditionOptions.good")},{v:"upgraded",l:t("refine.conditionOptions.upgraded")},{v:"renovated",l:t("refine.conditionOptions.renovated")}].map(({v,l}) => (
                          <button key={v} type="button" className={`${styles.chipBtn} ${refineData.condition===v?styles.chipBtnActive:""}`}
                            onClick={() => setRefineData({...refineData, condition: refineData.condition===v?"":v})}>{l}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6, color: "var(--text)" }}>{t("refine.parking")}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {[{v:"0",l:t("refine.parkingOptions.none")},{v:"1",l:t("refine.parkingOptions.one")},{v:"2",l:t("refine.parkingOptions.two")},{v:"3+",l:t("refine.parkingOptions.threePlus")}].map(({v,l}) => (
                          <button key={v} type="button" className={`${styles.chipBtn} ${refineData.parking===v?styles.chipBtnActive:""}`}
                            onClick={() => setRefineData({...refineData, parking: refineData.parking===v?"":v})}>{l}</button>
                        ))}
                      </div>
                    </div>

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

                {/* Data source badge */}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <div className={styles.badge} style={{ fontSize: 11 }}>
                    📊 {t("dataSource.label")}: {t("dataSource.value")}
                  </div>
                  <a href={`/${locale}/methodology`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
                    {t("dataSource.methodologyLink")} →
                  </a>
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
      {t("result.map.tip")}
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
                  [t("result.inputs.area"), getLocaleName(area, locale) || "—"],
                  ...(community ? [[t("home.community"), matched === "community" ? `${getLocaleNameWithEnglish(community, locale)} ✓` : getLocaleNameWithEnglish(community, locale)]] : []),
                  [t("result.inputs.type"), localType],
                  [t("result.inputs.bedrooms"), localBeds],
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

        {/* Subscribe card */}
        <div className={styles.subscribeCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 950 }}>{t("subscribe.title")}</div>
            <span className={styles.badge} style={{ fontSize: 11 }}>{t("subscribe.badge")}</span>
          </div>
          <div className={styles.k} style={{ lineHeight: 1.6, marginBottom: 12 }}>{t("subscribe.desc")}</div>

          {subStatus === "success" ? (
            <div className={styles.pillPos} style={{ fontSize: 13, padding: "10px 14px" }}>
              ✓ {t("subscribe.success")}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="email"
                value={subEmail}
                onChange={(e) => { setSubEmail(e.target.value); setSubStatus("idle"); }}
                placeholder={t("subscribe.emailPlaceholder")}
                style={{
                  flex: "1 1 200px",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: subStatus === "error" ? "1px solid #f87171" : "1px solid var(--border)",
                  background: "rgba(255,255,255,.05)",
                  color: "var(--text)",
                  fontSize: 13,
                  outline: "none",
                }}
                onKeyDown={(e) => e.key === "Enter" && onSubscribe()}
              />
              <button
                className={styles.btnPrimary}
                onClick={onSubscribe}
                disabled={subStatus === "loading"}
                style={{ flex: "0 0 auto", padding: "10px 18px", fontSize: 13 }}
              >
                {subStatus === "loading" ? t("subscribe.loading") : t("subscribe.button")}
              </button>
            </div>
          )}

          {subStatus === "error" && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#f87171", fontWeight: 700 }}>
              {t(`subscribe.${subErrKey}`)}
            </div>
          )}

          <div className={styles.k} style={{ marginTop: 8, fontSize: 11 }}>{t("subscribe.privacy")}</div>
        </div>

        {/* Feedback card */}
        <div className={styles.subscribeCard} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 950 }}>{t("feedback.title")}</div>
            <button
              onClick={() => setFbOpen((v) => !v)}
              style={{ fontSize: 12, fontWeight: 700, background: "none", border: "none", color: "var(--accent, #58a6ff)", cursor: "pointer", padding: "4px 8px" }}
            >
              {fbOpen ? "✕" : t("feedback.open")}
            </button>
          </div>
          {fbOpen && (
            <div style={{ marginTop: 10 }}>
              {fbStatus === "success" ? (
                <div className={styles.pillPos} style={{ fontSize: 13, padding: "10px 14px" }}>
                  ✓ {t("feedback.success")}
                </div>
              ) : (
                <>
                  <textarea
                    value={fbMsg}
                    onChange={(e) => setFbMsg(e.target.value)}
                    placeholder={t("feedback.placeholder")}
                    rows={3}
                    style={{
                      width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
                      border: "1px solid var(--border)", background: "rgba(255,255,255,.05)",
                      color: "var(--text)", fontSize: 13, resize: "vertical", outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <input
                      type="email" value={fbEmail} onChange={(e) => setFbEmail(e.target.value)}
                      placeholder={t("feedback.emailPlaceholder")}
                      style={{
                        flex: "1 1 180px", padding: "8px 12px", borderRadius: 10,
                        border: "1px solid var(--border)", background: "rgba(255,255,255,.05)",
                        color: "var(--text)", fontSize: 12, outline: "none",
                      }}
                    />
                    <button
                      className={styles.btnPrimary}
                      onClick={onSubmitFeedback}
                      disabled={fbStatus === "loading" || fbMsg.trim().length < 3}
                      style={{ flex: "0 0 auto", padding: "8px 16px", fontSize: 12 }}
                    >
                      {fbStatus === "loading" ? "…" : t("feedback.send")}
                    </button>
                  </div>
                  {fbStatus === "error" && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#f87171", fontWeight: 700 }}>{t("feedback.error")}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.footerBrand}>
          <img src="/logo.png" alt="UAEHomeValue" className={styles.footerLogo} />
          <div>
            <div className={styles.footerTitle}>UAEHomeValue</div>
            <div className={styles.footerCopy}>
              {t("footer.dataCredit")} · © {new Date().getFullYear()} UAEHomeValue
            </div>
            <div style={{ marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href={`/${locale}/methodology`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
                {t("footer.methodology")}
              </a>
              <a href={`/${locale}`} style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>
                ← {t("result.actions.recheck")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}