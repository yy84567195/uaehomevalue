"use client";

import { useTranslations, useLocale } from "next-intl";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import data from "@/data/price_ranges.json";

type PropertyType = "Apartment" | "Villa";

export default function HomePage() {
  const locale = useLocale();
  const tHome = useTranslations("home");

  const areas = useMemo<string[]>(() => {
    const rows = (data as any)?.communities ?? [];
    const list: string[] = rows
      .map((r: any) => String(r?.area ?? "").trim())
      .filter((a: string) => a.length > 0);
    return Array.from(new Set(list)).sort();
  }, []);

  const [area, setArea] = useState<string>("Dubai Marina");
  const [type, setType] = useState<PropertyType>("Apartment");
  const [beds, setBeds] = useState<number>(2);

  // 用 string 存面积，允许清空
  const [sizeSqftText, setSizeSqftText] = useState<string>("1250");

  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | undefined>(undefined);

  const sizeSqftNum = useMemo(() => {
    const v = sizeSqftText.trim();
    if (!v) return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }, [sizeSqftText]);

  const isValid = useMemo(
    () => !!area && Number.isFinite(sizeSqftNum) && sizeSqftNum > 0,
    [area, sizeSqftNum]
  );

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
          type, // 注意：这里仍然传 Apartment/Villa 给你的 API（不要翻译）
          beds,
          sizeSqft: Number(sizeSqftNum),
        }),
      });

      const out = await res.json();

      // 1️⃣ API 报错直接停止
      if (!res.ok || out?.error) {
        setErr(out?.error || tHome("error.generic"));
        return;
      }

      // 2️⃣ 强校验，防止 min=0 / max=0
      const minVal = Number(out?.min);
      const maxVal = Number(out?.max);

      if (
        !Number.isFinite(minVal) ||
        !Number.isFinite(maxVal) ||
        minVal <= 0 ||
        maxVal <= 0 ||
        maxVal <= minVal
      ) {
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
      });

      // ✅ 关键：带上当前语言前缀
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
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        padding: "36px 16px",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Logo Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <img src="/logo.png" alt="UAEHomeValue" style={{ height: 36 }} />
          <div style={{ fontWeight: 900, fontSize: 18 }}>UAEHomeValue</div>
        </div>

        <h1
          style={{
            fontSize: 34,
            fontWeight: 950,
            letterSpacing: -0.6,
            margin: 0,
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
          }}
        >
          {tHome("subtitle")}
        </p>

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
            <select value={area} onChange={(e) => setArea(e.target.value)} style={inputStyle}>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
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
            <div
              style={{
                marginTop: 12,
                color: "#991b1b",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {err}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 13,
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          {tHome("disclaimer")}
        </div>
      </div>
    </div>
  );
}