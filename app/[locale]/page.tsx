"use client";

import { useTranslations, useLocale } from "next-intl";
import { useMemo, useState, useEffect, useRef } from "react";
import data from "@/data/price_ranges.json";
import styles from "./HomePage.module.css";

const LS_KEY = "uaehv_last_search";

type PropertyType = "Apartment" | "Villa";

export default function HomePage() {
  const locale = useLocale();
  const tHome = useTranslations("home");
  const t = useTranslations(); 

  // 读数据行
  const rows = useMemo<any[]>(() => (data as any)?.communities ?? [], []);

  // Areas（大区域）
  const areas = useMemo<string[]>(() => {
    const list = rows
      .map((r: any) => String(r?.area ?? "").trim())
      .filter((a: string) => a.length > 0);
    return Array.from(new Set(list)).sort();
  }, [rows]);

  // ✅ Community map: area -> communities[]
  // 兼容：如果数据没有 community 字段，就用 area 自己当作 community（不会报错）
  const communitiesByArea = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, Set<string>> = {};

    for (const r of rows) {
      const a = String(r?.area ?? "").trim();
      const cRaw = (r as any)?.community;
      const c = String((cRaw ?? a) || "").trim(); // fallback
      if (!a || !c) continue;
      if (!map[a]) map[a] = new Set();
      map[a].add(c);
    }

    const out: Record<string, string[]> = {};
    for (const a of Object.keys(map)) out[a] = Array.from(map[a]).sort();
    return out;
  }, [rows]);

  // 默认值：如果 areas 里有 Dubai Marina 就选它，否则选第一个
  const defaultArea = useMemo(() => {
    if (areas.includes("Dubai Marina")) return "Dubai Marina";
    return areas[0] || "Dubai Marina";
  }, [areas]);

  const [area, setArea] = useState<string>(defaultArea);
  const [community, setCommunity] = useState<string>(""); // optional
  const [type, setType] = useState<PropertyType>("Apartment");
  const [beds, setBeds] = useState<number>(2);
  const [sizeSqftText, setSizeSqftText] = useState<string>("1250");
  const [loading, setLoading] = useState<boolean>(false);

  // Custom area picker state
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaSearch, setAreaSearch] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);

  // Close area picker when clicking outside
  useEffect(() => {
    if (!areaOpen) return;
    const handler = (e: MouseEvent) => {
      if (areaRef.current && !areaRef.current.contains(e.target as Node)) {
        setAreaOpen(false);
        setAreaSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [areaOpen]);

  // Restore last search from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.area && areas.includes(saved.area)) setArea(saved.area);
      if (saved.community !== undefined) setCommunity(String(saved.community));
      if (saved.type === "Apartment" || saved.type === "Villa") setType(saved.type);
      if (Number.isFinite(Number(saved.beds))) setBeds(Number(saved.beds));
      if (saved.sizeSqft) setSizeSqftText(String(saved.sizeSqft));
    } catch {
      // ignore malformed localStorage
    }
  }, [areas]);

  // ✅ 用 error code 存储，更稳：不会出现 NO_DATA 直接展示出来
  const [errCode, setErrCode] = useState<string | undefined>(undefined);

  const errText = useMemo(() => {
    if (!errCode) return "";
    if (errCode === "NO_DATA") return tHome("error.noData");
    if (errCode === "NO_DATA_AREA_COMMUNITY") return tHome("error.noDataAreaCommunity");
    if (errCode === "INVALID_SIZE" || errCode === "INVALID_INPUT") return tHome("error.size");
    if (errCode === "NETWORK") return tHome("error.network");
    return tHome("error.generic");
  }, [errCode, tHome]);

  // 当前 area 下的 communities
  const communitiesForArea = useMemo<string[]>(() => {
    return communitiesByArea[area] ?? [];
  }, [communitiesByArea, area]);

  const sizeSqftNum = useMemo(() => {
    const v = sizeSqftText.trim();
    if (!v) return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }, [sizeSqftText]);

  const isValid = useMemo(() => !!area && Number.isFinite(sizeSqftNum) && sizeSqftNum > 0, [area, sizeSqftNum]);

  async function onSubmit() {
    setErrCode(undefined);

    if (!isValid) {
      setErrCode("INVALID_SIZE");
      return;
    }

    setLoading(true);
    try {
  const res = await fetch("/api/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      area,
      community: String(community || ""),
      building: "",
      type, // 注意：仍然传 Apartment/Villa（不要翻译）
      beds,
      sizeSqft: Number(sizeSqftNum),
    }),
  });

  const out = await res.json();

  // ✅ API 报错：统一返回 error code（兼容旧的英文 error 文案）
  if (!res.ok || out?.error) {
    const e = String(out?.error || "");

    if (e === "NO_DATA" || e.includes("No estimate available")) {
      setErrCode("NO_DATA_AREA_COMMUNITY");
    } else if (e === "INVALID_INPUT" || e.includes("Invalid")) {
      setErrCode("INVALID_INPUT");
    } else {
      setErrCode("GENERIC");
    }
    return;
  }

  const minVal = Number(out?.min);
  const maxVal = Number(out?.max);

  // ✅ 防止 min/max 异常
  if (
    !Number.isFinite(minVal) ||
    !Number.isFinite(maxVal) ||
    minVal <= 0 ||
    maxVal <= 0 ||
    maxVal <= minVal
  ) {
    setErrCode("NO_DATA_AREA_COMMUNITY");
    return;
  }

  // Save search inputs to localStorage for next visit
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      area,
      community: community || "",
      type,
      beds,
      sizeSqft: sizeSqftNum,
    }));
  } catch { /* ignore */ }

  const params = new URLSearchParams({
    area,
    community: String(community || ""),
    type,
    beds: String(beds),
    sizeSqft: String(Number(sizeSqftNum)),
    min: String(minVal),
    max: String(maxVal),
    confidence: String(out?.confidence || "Medium"),
  });

  // ✅ 保持 locale 前缀（你现在是 /[locale] 结构）
  window.location.href = `/${locale}/result?${params.toString()}`;
} catch {
  setErrCode("NETWORK");
} finally {
  setLoading(false);
}
  }

return (
  <div className={styles.page}>
    <div className={styles.container}>

      <div className={styles.heroGrid}>
        {/* 你的 hero 内容保持不动 */}
          {/* Left */}
          <section className={`${styles.card} ${styles.heroLeft}`}>
            <h1 className={styles.h1}>{tHome("title")}</h1>
            <p className={styles.p}>{tHome("subtitle")}</p>

            <div className={styles.heroBadges}>
              {[
                tHome("badges.fast"),
                tHome("badges.areaCommunity"),
                tHome("badges.noAgents"),
                tHome("badges.noAds"),
                tHome("badges.noSpam"),
              ].map((txt) => (
                <span key={txt} className={styles.badge}>
                  {txt}
                </span>
              ))}
            </div>

            <div className={styles.disclaimer}>{tHome("disclaimer")}</div>
          </section>

          {/* Right */}
          <section className={`${styles.card} ${styles.formCard}`}>
            {/* Hot areas quick-select */}
            <div className={styles.quickAreas}>
              {["Dubai Marina", "Downtown Dubai", "JVC", "Palm Jumeirah", "Business Bay", "JLT"].map((a) => {
                const exists = areas.includes(a);
                if (!exists) return null;
                return (
                  <button
                    key={a}
                    type="button"
                    className={area === a ? styles.quickAreaActive : styles.quickArea}
                    onClick={() => { setArea(a); setCommunity(""); }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>

            <div className={styles.formGrid}>
              {/* Area — custom searchable picker */}
              <div className={`${styles.field} ${styles.fullRow}`} ref={areaRef} style={{ position: "relative", gridColumn: "1 / -1" }}>
                <div className={styles.label}>{tHome("area")}</div>
                <button
                  type="button"
                  className={`${styles.control} ${styles.pickerTrigger}`}
                  onClick={() => { setAreaOpen((v) => !v); setAreaSearch(""); }}
                  aria-expanded={areaOpen}
                >
                  <span>{area}</span>
                  <svg
                    width="14" height="14" viewBox="0 0 16 16" fill="none"
                    style={{ flexShrink: 0, transition: "transform .15s", transform: areaOpen ? "rotate(180deg)" : "rotate(0)" }}
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {areaOpen && (
                  <div className={styles.pickerDropdown}>
                    <input
                      autoFocus
                      type="text"
                      className={styles.pickerSearch}
                      placeholder="Search area…"
                      value={areaSearch}
                      onChange={(e) => setAreaSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setAreaOpen(false); setAreaSearch(""); }
                        if (e.key === "Enter") {
                          const filtered = areas.filter((a) => a.toLowerCase().includes(areaSearch.toLowerCase()));
                          if (filtered.length > 0) { setArea(filtered[0]); setCommunity(""); setAreaOpen(false); setAreaSearch(""); }
                        }
                      }}
                    />
                    <div className={styles.pickerGrid}>
                      {areas
                        .filter((a) => a.toLowerCase().includes(areaSearch.toLowerCase()))
                        .map((a) => (
                          <button
                            key={a}
                            type="button"
                            className={`${styles.pickerChip} ${area === a ? styles.pickerChipActive : ""}`}
                            onClick={() => { setArea(a); setCommunity(""); setAreaOpen(false); setAreaSearch(""); }}
                          >
                            {a}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Community — inline chips (max 14, no dropdown needed) */}
              <div className={`${styles.field} ${styles.fullRow}`}>
                <div className={styles.label}>{tHome("community")}</div>
                <div className={styles.communityChips}>
                  <button
                    type="button"
                    className={`${styles.communityChip} ${!community ? styles.communityChipActive : ""}`}
                    onClick={() => setCommunity("")}
                  >
                    {tHome("communityAll")}
                  </button>
                  {communitiesForArea.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`${styles.communityChip} ${community === c ? styles.communityChipActive : ""}`}
                      onClick={() => setCommunity(community === c ? "" : c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type */}
              <div className={styles.field}>
                <div className={styles.label}>{tHome("type")}</div>
                <select className={styles.control} value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
                  <option value="Apartment">{tHome("typeOptions.apartment")}</option>
                  <option value="Villa">{tHome("typeOptions.villa")}</option>
                </select>
              </div>

              {/* Bedrooms */}
              <div className={styles.field}>
                <div className={styles.label}>{tHome("beds")}</div>
                <select
                  className={styles.control}
                  value={beds === 6 ? "4plus" : String(beds)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBeds(v === "4plus" ? 6 : Number(v));
                  }}
                >
                  <option value="0">{tHome("bedsOptions.studio")}</option>
                  <option value="1">{tHome("bedsOptions.1")}</option>
                  <option value="2">{tHome("bedsOptions.2")}</option>
                  <option value="3">{tHome("bedsOptions.3")}</option>
                  <option value="4plus">{tHome("bedsOptions.4plus")}</option>
                </select>
              </div>

              {/* Size */}
              <div className={`${styles.field} ${styles.fullRow}`}>
                <div className={styles.label}>{tHome("size")}</div>
                <input
                  className={styles.control}
                  inputMode="numeric"
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
{/* Footer brand (same as Result page) */}
<div className={styles.footerBrand}>
  <img src="/logo.png" alt="UAEHomeValue" className={styles.footerLogo} />
  <div>
    <div className={styles.footerTitle}>UAEHomeValue</div>
    <div className={styles.footerCopy}>
      <div className={styles.footerCopy}>
  Estimate first · Decide better  © {new Date().getFullYear()} UAEHomeValue
</div>
    </div>
  </div>
</div>
    </div>
  );

}