"use client";

import { useTranslations, useLocale } from "next-intl";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import data from "@/data/price_ranges.json";
import { getLocaleName, getLocaleNameWithEnglish } from "@/data/area-names";
import styles from "./HomePage.module.css";

const LS_KEY = "uaehv_last_search";

type PropertyType = "Apartment" | "Villa";
type City = "Dubai" | "Abu Dhabi";

const DUBAI_AREAS = new Set([
  "Al Barari", "Arabian Ranches", "Arabian Ranches 2", "Bluewaters Island",
  "Business Bay", "City Walk", "DAMAC Hills", "DIFC", "Downtown Dubai",
  "Dubai Creek Harbour", "Dubai Harbour", "Dubai Hills Estate", "Dubai Marina",
  "JBR", "JLT", "JVC", "Jumeirah Golf Estates", "MBR City", "Palm Jumeirah",
  "The Greens", "The Lakes", "The Meadows", "The Springs", "The Views",
]);

function cityForArea(area: string): City {
  if (DUBAI_AREAS.has(area)) return "Dubai";
  return "Abu Dhabi";
}

export default function HomePage() {
  const locale = useLocale();
  const tHome = useTranslations("home");

  const rows = useMemo<any[]>(() => (data as any)?.communities ?? [], []);

  const allAreas = useMemo<string[]>(() => {
    const list = rows
      .map((r: any) => String(r?.area ?? "").trim())
      .filter((a: string) => a.length > 0);
    return Array.from(new Set(list)).sort();
  }, [rows]);

  const communitiesByArea = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, Set<string>> = {};
    for (const r of rows) {
      const a = String(r?.area ?? "").trim();
      const cRaw = (r as any)?.community;
      const c = String((cRaw ?? a) || "").trim();
      if (!a || !c) continue;
      if (!map[a]) map[a] = new Set();
      map[a].add(c);
    }
    const out: Record<string, string[]> = {};
    for (const a of Object.keys(map)) out[a] = Array.from(map[a]).sort();
    return out;
  }, [rows]);

  const communitiesWithData = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const c = String((r as any)?.community ?? "").trim();
      if (c) s.add(c);
    }
    return s;
  }, [rows]);

  const [city, setCity] = useState<City>("Dubai");
  const [area, setArea] = useState<string>("Dubai Marina");
  const [community, setCommunity] = useState<string>("");
  const [type, setType] = useState<PropertyType>("Apartment");
  const [beds, setBeds] = useState<number>(2);
  const [sizeSqftText, setSizeSqftText] = useState<string>("1250");
  const [loading, setLoading] = useState<boolean>(false);

  const [areaOpen, setAreaOpen] = useState(false);
  const [areaSearch, setAreaSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const areasForCity = useMemo(() => {
    return allAreas.filter((a) => cityForArea(a) === city);
  }, [allAreas, city]);

  const communitiesForArea = useMemo<string[]>(() => {
    return communitiesByArea[area] ?? [];
  }, [communitiesByArea, area]);

  const handleCityChange = useCallback((c: City) => {
    setCity(c);
    const cityAreas = allAreas.filter((a) => cityForArea(a) === c);
    if (cityAreas.length > 0 && !cityAreas.includes(area)) {
      setArea(cityAreas[0]);
      setCommunity("");
    }
  }, [allAreas, area]);

  useEffect(() => {
    if (areaOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [areaOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.city === "Dubai" || saved.city === "Abu Dhabi") setCity(saved.city);
      if (saved.area && allAreas.includes(saved.area)) {
        setArea(saved.area);
        if (saved.city) setCity(saved.city);
        else setCity(cityForArea(saved.area));
      }
      if (saved.community !== undefined) setCommunity(String(saved.community));
      if (saved.type === "Apartment" || saved.type === "Villa") setType(saved.type);
      if (Number.isFinite(Number(saved.beds))) setBeds(Number(saved.beds));
      if (saved.sizeSqft) setSizeSqftText(String(saved.sizeSqft));
    } catch { /* ignore */ }
  }, [allAreas]);

  const [errCode, setErrCode] = useState<string | undefined>(undefined);

  const errText = useMemo(() => {
    if (!errCode) return "";
    if (errCode === "NO_DATA") return tHome("error.noData");
    if (errCode === "NO_DATA_AREA_COMMUNITY") return tHome("error.noDataAreaCommunity");
    if (errCode === "INVALID_SIZE" || errCode === "INVALID_INPUT") return tHome("error.size");
    if (errCode === "NETWORK") return tHome("error.network");
    return tHome("error.generic");
  }, [errCode, tHome]);

  const sizeSqftNum = useMemo(() => {
    const v = sizeSqftText.trim();
    if (!v) return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }, [sizeSqftText]);

  const isValid = useMemo(() => !!area && Number.isFinite(sizeSqftNum) && sizeSqftNum > 0, [area, sizeSqftNum]);

  async function onSubmit() {
    setErrCode(undefined);
    if (!isValid) { setErrCode("INVALID_SIZE"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area, community: String(community || ""), building: "", type, beds,
          sizeSqft: Number(sizeSqftNum),
        }),
      });
      const out = await res.json();
      if (!res.ok || out?.error) {
        const e = String(out?.error || "");
        if (e === "NO_DATA" || e.includes("No estimate available")) {
          if (out?.suggested_areas?.length) {
            setErrCode("NO_DATA_AREA_COMMUNITY");
          } else {
            setErrCode("NO_DATA_AREA_COMMUNITY");
          }
        }
        else if (e === "INVALID_INPUT" || e.includes("Invalid")) setErrCode("INVALID_INPUT");
        else setErrCode("GENERIC");
        return;
      }
      const minVal = Number(out?.min);
      const maxVal = Number(out?.max);
      if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal <= 0 || maxVal <= 0 || maxVal <= minVal) {
        setErrCode("NO_DATA_AREA_COMMUNITY"); return;
      }
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ city, area, community: community || "", type, beds, sizeSqft: sizeSqftNum }));
      } catch { /* ignore */ }
      const params = new URLSearchParams({
        area, community: String(community || ""), type, beds: String(beds),
        sizeSqft: String(Number(sizeSqftNum)), min: String(minVal), max: String(maxVal),
        confidence: String(out?.confidence || "Medium"),
        rent_min: String(out?.rent_min || 0),
        rent_max: String(out?.rent_max || 0),
        fallback: String(out?.fallback_level || "exact"),
      });
      window.location.href = `/${locale}/result?${params.toString()}`;
    } catch { setErrCode("NETWORK"); }
    finally { setLoading(false); }
  }

  const hotAreas: Record<City, string[]> = {
    Dubai: ["Dubai Marina", "Downtown Dubai", "JVC", "Palm Jumeirah", "Business Bay", "JLT"],
    "Abu Dhabi": ["Al Reem Island", "Yas Island", "Saadiyat Island", "Al Raha Beach", "Khalifa City"],
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.heroGrid}>
          {/* Left — hero */}
          <section className={`${styles.card} ${styles.heroLeft}`}>
            <h1 className={styles.h1}>{tHome("title")}</h1>
            <p className={styles.p}>{tHome("subtitle")}</p>
            <div className={styles.heroBadges}>
              {[tHome("badges.fast"), tHome("badges.areaCommunity"), tHome("badges.noAgents"), tHome("badges.noAds"), tHome("badges.noSpam")].map((txt) => (
                <span key={txt} className={styles.badge}>{txt}</span>
              ))}
            </div>
            <div className={styles.disclaimer}>{tHome("disclaimer")}</div>
          </section>

          {/* Right — form */}
          <section className={`${styles.card} ${styles.formCard}`}>
            {/* City tabs */}
            <div className={styles.cityTabs}>
              {(["Dubai", "Abu Dhabi"] as City[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={city === c ? styles.cityTabActive : styles.cityTab}
                  onClick={() => handleCityChange(c)}
                >
                  {c === "Dubai" ? `🏙 ${tHome("cityDubai")}` : `🕌 ${tHome("cityAbuDhabi")}`}
                </button>
              ))}
            </div>

            {/* Hot areas */}
            <div className={styles.quickAreas}>
              {(hotAreas[city] || []).map((a) => {
                const exists = areasForCity.includes(a);
                if (!exists) return null;
                return (
                  <button key={a} type="button"
                    className={area === a ? styles.quickAreaActive : styles.quickArea}
                    onClick={() => { setArea(a); setCommunity(""); }}
                  >{getLocaleName(a, locale)}</button>
                );
              })}
            </div>

            <div className={styles.formGrid}>
              {/* Area — opens modal overlay */}
              <div className={`${styles.field} ${styles.fullRow}`}>
                <div className={styles.label}>{tHome("area")}</div>
                <button
                  type="button"
                  className={`${styles.control} ${styles.pickerTrigger}`}
                  onClick={() => { setAreaOpen(true); setAreaSearch(""); }}
                >
                  <span>{getLocaleName(area, locale)}</span>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Community chips */}
              <div className={`${styles.field} ${styles.fullRow}`}>
                <div className={styles.label}>{tHome("community")}</div>
                <div className={styles.communityChips}>
                  <button type="button"
                    className={`${styles.communityChip} ${!community ? styles.communityChipActive : ""}`}
                    onClick={() => setCommunity("")}
                  >{tHome("communityAll")}</button>
                  {communitiesForArea.map((c) => (
                    <button key={c} type="button"
                      className={`${styles.communityChip} ${community === c ? styles.communityChipActive : ""}`}
                      onClick={() => setCommunity(community === c ? "" : c)}
                    >{getLocaleNameWithEnglish(c, locale)}{communitiesWithData.has(c) && <span className={styles.dataIndicator} />}</button>
                  ))}
                </div>
              </div>

              {/* Type — chips */}
              <div className={styles.field}>
                <div className={styles.label}>{tHome("type")}</div>
                <div className={styles.chipRow}>
                  {([["Apartment", tHome("typeOptions.apartment")], ["Villa", tHome("typeOptions.villa")]] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      className={`${styles.communityChip} ${type === val ? styles.communityChipActive : ""}`}
                      onClick={() => setType(val as PropertyType)}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Bedrooms — chips */}
              <div className={styles.field}>
                <div className={styles.label}>{tHome("beds")}</div>
                <div className={styles.chipRow}>
                  {([{v:0,l:tHome("bedsOptions.studio")},{v:1,l:"1"},{v:2,l:"2"},{v:3,l:"3"},{v:6,l:"4+"}]).map(({v,l}) => (
                    <button key={v} type="button"
                      className={`${styles.communityChip} ${beds === v ? styles.communityChipActive : ""}`}
                      onClick={() => setBeds(v)}
                    >{l}</button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div className={`${styles.field} ${styles.fullRow}`}>
                <div className={styles.label}>{tHome("size")}</div>
                <input className={styles.control} inputMode="numeric"
                  value={sizeSqftText}
                  onChange={(e) => setSizeSqftText(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder={tHome("sizePlaceholder")}
                />
                <div className={styles.helper}>{tHome("sizeTip")}</div>
              </div>

              {/* Submit */}
              <div className={`${styles.fullRow} ${styles.actions}`}>
                <button className={styles.btnPrimary} onClick={onSubmit} disabled={!isValid || loading}>
                  {loading ? tHome("button.loading") : tHome("button.default")}
                </button>
                {errText ? <div className={styles.error}>{errText}</div> : null}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footerBrand}>
        <img src="/logo.png" alt="UAEHomeValue" className={styles.footerLogo} />
        <div>
          <div className={styles.footerTitle}>UAEHomeValue</div>
          <div className={styles.footerCopy}>
            Estimate first · Decide better &nbsp;© {new Date().getFullYear()} UAEHomeValue
          </div>
        </div>
      </div>

      {/* ===== Area picker modal overlay ===== */}
      {areaOpen && (
        <div className={styles.pickerOverlay} onClick={() => { setAreaOpen(false); setAreaSearch(""); }}>
          <div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerHeader}>
              <span className={styles.pickerTitle}>{tHome("area")}</span>
              <button type="button" className={styles.pickerClose} onClick={() => { setAreaOpen(false); setAreaSearch(""); }}>✕</button>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className={styles.pickerSearch}
              placeholder={tHome("searchArea")}
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setAreaOpen(false); setAreaSearch(""); }
                if (e.key === "Enter") {
                  const q = areaSearch.toLowerCase();
                  const filtered = areasForCity.filter((a) => a.toLowerCase().includes(q) || getLocaleName(a, locale).toLowerCase().includes(q));
                  if (filtered.length > 0) { setArea(filtered[0]); setCommunity(""); setAreaOpen(false); setAreaSearch(""); }
                }
              }}
            />
            <div className={styles.pickerGrid}>
              {areasForCity
                .filter((a) => { const q = areaSearch.toLowerCase(); return a.toLowerCase().includes(q) || getLocaleName(a, locale).toLowerCase().includes(q); })
                .map((a) => (
                  <button key={a} type="button"
                    className={`${styles.pickerChip} ${area === a ? styles.pickerChipActive : ""}`}
                    onClick={() => { setArea(a); setCommunity(""); setAreaOpen(false); setAreaSearch(""); }}
                  >{getLocaleNameWithEnglish(a, locale)}</button>
                ))}
              {areasForCity.filter((a) => { const q = areaSearch.toLowerCase(); return a.toLowerCase().includes(q) || getLocaleName(a, locale).toLowerCase().includes(q); }).length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
                  {tHome("noAreasFound")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
