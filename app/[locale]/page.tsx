"use client";

import { useTranslations, useLocale } from "next-intl";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import data from "@/data/price_ranges.json";

type PropertyType = "Apartment" | "Villa";

export default function HomePage() {
  const locale = useLocale();
  const tHome = useTranslations("home");

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
      const c = String((cRaw ?? a) || "").trim(); // fallback: 没有 community 就用 area

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

  // 用 string 存面积，允许清空
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

        // 兼容：后端如果直接返回英文句子，也能映射到 code
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

  const labelStyle: CSSProperties = {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 8,
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 700,
    outline: "none",
  };

  const helperStyle: CSSProperties = {
    fontSize: 13,
    color: "#334155",
    marginTop: 10,
    lineHeight: 1.55,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", padding: "36px 16px", color: "#0f172a" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Logo Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <img src="/logo.png" alt="UAEHomeValue" style={{ height: 36 }} />
          <div style={{ fontWeight: 900, fontSize: 18 }}>UAEHomeValue</div>
        </div>

        {/* HERO */}
        <h1 style={{ fontSize: 34, fontWeight: 950, letterSpacing: -0.6, margin: 0, lineHeight: 1.12 }}>
          {tHome("title")}
        </h1>

        <p style={{ marginTop: 10, color: "#334155", fontSize: 16, fontWeight: 700, lineHeight: 1.45 }}>
          {tHome("subtitle")}
        </p>

        {/* Trust badges */}
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            tHome("badges.fast"),
            tHome("badges.areaCommunity"),
            tHome("badges.noAgents"),
            tHome("badges.noAds"),
            tHome("badges.noSpam"),
          ].map((txt) => (
            <div
              key={txt}
              style={{
                fontSize: 12,
                fontWeight: 900,
                padding: "6px 10px",
                borderRadius: 999,
                background: "#f1f5f9",
                color: "#0f172a",
                border: "1px solid #e2e8f0",
              }}
            >
              {txt}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
          }}
        >
          {/* Area */}
          <div>
            <div style={labelStyle}>{tHome("area")}</div>
            <select
              value={area}
              onChange={(e) => {
                const nextArea = e.target.value;
                setArea(nextArea);
                setCommunity(""); // 切换大区域清空小区
              }}
              style={inputStyle}
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Community (optional) */}
          <div>
            <div style={labelStyle}>{tHome("community")}</div>
            <select value={community} onChange={(e) => setCommunity(e.target.value)} style={inputStyle}>
              <option value="">{tHome("communityAll")}</option>
              {communitiesForArea.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <div style={labelStyle}>{tHome("type")}</div>
            <select value={type} onChange={(e) => setType(e.target.value as PropertyType)} style={inputStyle}>
              <option value="Apartment">{tHome("typeOptions.apartment")}</option>
              <option value="Villa">{tHome("typeOptions.villa")}</option>
            </select>
          </div>

          {/* Bedrooms */}
          <div>
            <div style={labelStyle}>{tHome("beds")}</div>
            <select
              value={beds === 6 ? "4plus" : String(beds)}
              onChange={(e) => {
                const v = e.target.value;
                // ✅ 4+ → 直接当 6 传给后端（后端做 fallback）
                setBeds(v === "4plus" ? 6 : Number(v));
              }}
              style={inputStyle}
            >
              <option value="0">{tHome("bedsOptions.studio")}</option>
              <option value="1">{tHome("bedsOptions.1")}</option>
              <option value="2">{tHome("bedsOptions.2")}</option>
              <option value="3">{tHome("bedsOptions.3")}</option>
              <option value="4plus">{tHome("bedsOptions.4plus")}</option>
            </select>
          </div>

          {/* Size */}
          <div>
            <div style={labelStyle}>{tHome("size")}</div>
            <input
              inputMode="numeric"
              value={sizeSqftText}
              onChange={(e) => setSizeSqftText(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={tHome("sizePlaceholder")}
              style={inputStyle}
            />
            <div style={helperStyle}>{tHome("sizeTip")}</div>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <button
            onClick={onSubmit}
            disabled={!isValid || loading}
            style={{
              width: "100%",
              padding: "16px 16px",
              borderRadius: 16,
              border: "none",
              background: "#0ea5e9",
              color: "#ffffff",
              fontWeight: 950,
              cursor: "pointer",
              fontSize: 16,
              letterSpacing: -0.2,
              opacity: !isValid || loading ? 0.75 : 1,
            }}
          >
            {loading ? tHome("button.loading") : tHome("button.default")}
          </button>

          {errText ? (
            <div style={{ marginTop: 12, color: "#b91c1c", fontWeight: 800 }}>
              {errText}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 18, fontSize: 13, color: "#64748b", fontWeight: 700 }}>{tHome("disclaimer")}</div>
      </div>
    </div>
  );
}