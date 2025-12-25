"use client";

import { useTranslations, useLocale } from "next-intl";
import { useMemo, useState } from "react";
import data from "@/data/price_ranges.json";
import styles from "./HomePage.module.css";

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
      if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal <= 0 || maxVal <= 0 || maxVal <= minVal) {
        setErrCode("NO_DATA_AREA_COMMUNITY");
        return;
      }

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
            <div className={styles.formGrid}>
              {/* Area */}
              <div className={styles.field}>
                <div className={styles.label}>{tHome("area")}</div>
                <select
                  className={styles.control}
                  value={area}
                  onChange={(e) => {
                    const nextArea = e.target.value;
                    setArea(nextArea);
                    setCommunity("");
                  }}
                >
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Community */}
              <div className={styles.field}>
                <div className={styles.label}>{tHome("community")}</div>
                <select className={styles.control} value={community} onChange={(e) => setCommunity(e.target.value)}>
                  <option value="">{tHome("communityAll")}</option>
                  {communitiesForArea.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
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
      © {new Date().getFullYear()} UAEHomeValue · {t("footer.copy")}
    </div>
  </div>
</div>
    </div>
  );

}