"use client";

import { useMemo, useState } from "react";
import data from "@/data/price_ranges.json";

type PropertyType = "Apartment" | "Villa";

export default function HomePage() {
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
    const t = sizeSqftText.trim();
    if (!t) return NaN;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }, [sizeSqftText]);

  const isValid = useMemo(
    () => !!area && Number.isFinite(sizeSqftNum) && sizeSqftNum > 0,
    [area, sizeSqftNum]
  );

  async function onSubmit() {
    setErr(undefined);
    if (!isValid) {
      setErr("Please enter a valid size (sqft).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, type, beds, sizeSqft: Number(sizeSqftNum) }),
      });

      const out = await res.json();

      const params = new URLSearchParams({
        area,
        type,
        beds: String(beds),
        sizeSqft: String(Number(sizeSqftNum)),
        min: String(out.min || 0),
        max: String(out.max || 0),
        confidence: String(out.confidence || "Medium"),
      });

      window.location.href = `/result?${params.toString()}`;
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 8,
  };

  const inputStyle: React.CSSProperties = {
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

  const helperStyle: React.CSSProperties = {
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
        {/* ✅ Logo Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <img
            src="/logo.png"
            alt="UAEHomeValue"
            style={{ height: 36 }}
          />
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            UAEHomeValue
          </div>
        </div>

        <h1
          style={{
            fontSize: 34,
            fontWeight: 950,
            letterSpacing: -0.6,
            margin: 0,
          }}
        >
          Check your home value in Dubai
        </h1>

        <p
          style={{
            marginTop: 10,
            color: "#334155",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Estimate first. Decide better.
        </p>

        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
          }}
        >
          {/* Area */}
          <div>
            <div style={labelStyle}>Area</div>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={inputStyle}
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <div style={labelStyle}>Property type</div>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as PropertyType)
              }
              style={inputStyle}
            >
              <option value="Apartment">Apartment</option>
              <option value="Villa">Villa</option>
            </select>
          </div>

          {/* Beds */}
          <div>
            <div style={labelStyle}>Bedrooms</div>
            <select
              value={beds}
              onChange={(e) =>
                setBeds(Number(e.target.value))
              }
              style={inputStyle}
            >
              <option value={0}>Studio</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4+</option>
            </select>
          </div>

          {/* Size */}
          <div>
            <div style={labelStyle}>Size (sqft)</div>
            <input
              inputMode="numeric"
              value={sizeSqftText}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "");
                setSizeSqftText(v);
              }}
              placeholder="e.g. 1250"
              style={inputStyle}
            />
            <div style={helperStyle}>
              Tip: you can clear the field and type again.
            </div>
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
            {loading ? "Calculating…" : "Check My Home Value"}
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
          Independent market-based estimate · No listings · No agents
        </div>
      </div>
    </div>
  );
}