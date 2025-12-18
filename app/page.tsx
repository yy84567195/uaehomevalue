"use client";

import { useMemo, useState } from "react";
import data from "@/data/price_ranges.json";

type PropertyType = "Apartment" | "Villa";

export default function HomePage() {
  // ✅ Build a SAFE string[] areas list (no unknown, no TS error)
  const areas = useMemo<string[]>(() => {
    const rows = (data as any)?.communities ?? [];
    const list: string[] = rows
      .map((r: any) => String(r?.area ?? "").trim())
      .filter((a: string) => a.length > 0);
    return Array.from(new Set(list)).sort();
  }, []);

  // States
  const [area, setArea] = useState<string>("Dubai Marina");
  const [type, setType] = useState<PropertyType>("Apartment");
  const [beds, setBeds] = useState<number>(2);
  const [sizeSqft, setSizeSqft] = useState<number>(1250);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | undefined>(undefined);

  const isValid = useMemo(() => !!area && sizeSqft > 0, [area, sizeSqft]);

  async function onSubmit() {
    setErr(undefined);
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, type, beds, sizeSqft }),
      });

      const out = await res.json();

      const params = new URLSearchParams({
        area,
        type,
        beds: String(beds),
        sizeSqft: String(sizeSqft),
        min: String(out.min || 0),
        max: String(out.max || 0),
        confidence: String(out.confidence || "Medium"),
      });

      window.location.href = `/result?${params.toString()}`;
    } catch (e) {
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", padding: "40px 16px", color: "#0f172a" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -0.6 }}>
          Check your home value in Dubai
        </h1>

        <p style={{ marginTop: 8, color: "#475569" }}>
          Estimate first. Decide better.
        </p>

        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
          {/* Area */}
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Area</div>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
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
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Property type</div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PropertyType)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
            >
              <option value="Apartment">Apartment</option>
              <option value="Villa">Villa</option>
            </select>
          </div>

          {/* Beds */}
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Bedrooms</div>
            <select
              value={beds}
              onChange={(e) => setBeds(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
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
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Size (sqft)</div>
            <input
              type="number"
              value={sizeSqft}
              onChange={(e) => setSizeSqft(Number(e.target.value))}
              placeholder="e.g. 1250"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0" }}
            />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <button
            onClick={onSubmit}
            disabled={!isValid || loading}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "none",
              background: "#0ea5e9",
              color: "#ffffff",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            {loading ? "Calculating…" : "Check My Home Value"}
          </button>

          {err && (
            <div style={{ marginTop: 12, color: "#991b1b", fontSize: 13 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ marginTop: 20, fontSize: 12, color: "#94a3b8" }}>
          Independent market-based estimate · No listings · No agents
        </div>
      </div>
    </div>
  );
}