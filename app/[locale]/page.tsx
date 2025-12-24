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
      const c = String((cRaw ?? a) || "").trim(); // ✅ fallback: 没有 community 就用 area

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
  const [err, setErr] = useState<string | undefined>(undefined);

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
    setErr(undefined);

    if (!isValid) {
      setErr(tHome("error.size"));
      return;
    }

    setLoading(true);
    try {
const res = await fetch("/api/estimate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    area,
    community: community || "", // ✅ 新增：可选 community（没有就传空）
    type, // Apartment / Villa（不要翻译）
    beds,
    sizeSqft: Number(sizeSqftNum),
  }),
});

      const out = await res.json();

      if (!res.ok || out?.error) {
        setErr(out?.error || tHome("error.generic"));
        return;
      }

      const minVal = Number(out?.min);
      const maxVal = Number(out?.max);

      if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal <= 0 || maxVal <= 0 || maxVal <= minVal) {
        setErr(tHome("error.noData"));
        return;
      }

      const params = new URLSearchParams({
  area,
  type,
  beds: String(beds),
  sizeSqft: String(Number(sizeSqftNum)),
  min: String(minVal),
  max: String(maxVal),
  confidence: String(out?.confidence || "Medium"),
  community: String(community || ""),
  matched: String(out?.meta?.matched || ""),
});

      window.location.href = `/${locale}/result?${params.toString()}`;
    } catch {
      setErr(tHome("error.network"));
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
<h1
  style={{
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: -0.6,
    margin: 0,
    lineHeight: 1.12,
  }}
>
  {tHome("title")}
</h1>

<p
  style={{
    marginTop: 10,
    color: "#334155",
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.45,
  }}
>
  {tHome("subtitle")}
</p>

{/* Trust badges */}
<div
  style={{
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  }}
>
  {[
    "30s check",
    "Area + Community",
    "No agents",
    "No ads",
    "No spam",
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
                setCommunity(""); // ✅ 切换大区域清空小区
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
            <div style={labelStyle}>Community (optional)</div>
            <select value={community} onChange={(e) => setCommunity(e.target.value)} style={inputStyle}>
              <option value="">All communities</option>
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

          {/* Beds */}
          <div>
            <div style={labelStyle}>{tHome("beds")}</div>
            <select value={beds} onChange={(e) => setBeds(Number(e.target.value))} style={inputStyle}>
              <option value={0}>{tHome("bedsOptions.studio")}</option>
              <option value={1}>{tHome("bedsOptions.1")}</option>
              <option value={2}>{tHome("bedsOptions.2")}</option>
              <option value={3}>{tHome("bedsOptions.3")}</option>
              <option value={4}>{tHome("bedsOptions.4plus")}</option>
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

          {err && (
            <div style={{ marginTop: 12, color: "#991b1b", fontSize: 14, fontWeight: 800 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ marginTop: 18, fontSize: 13, color: "#64748b", fontWeight: 700 }}>{tHome("disclaimer")}</div>
      </div>
    </div>
  );
}