"use client";

import { useMemo, useState } from "react";
import data from "@/data/price_ranges.json";

const areas = Array.from(
  new Set((data as any).communities.map((r: any) => String(r.area)))
).sort() as string[];

export default function HomePage() {
  const [area, setArea] = useState("Dubai Marina");
  const [type, setType] = useState<"Apartment" | "Villa">("Apartment");
  const [beds, setBeds] = useState(2);
  const [sizeSqft, setSizeSqft] = useState(1250);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | undefined>(undefined);

  const isValid = useMemo(() => area && sizeSqft > 0, [area, sizeSqft]);

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
        confidence: String(out.confidence || "Low"),
      });

      window.location.href = `/result?${params.toString()}`;
    } catch (e: any) {
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid2">
      <div className="card cardPad">
        <h1 className="h1">Check your home value in Dubai — instantly.</h1>
        <p className="p">
          Free price estimate range based on nearby market data. No sign-up required.
        </p>

        <div className="row row4">
          <div>
            <div className="label">Area</div>
            <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Type</div>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="Apartment">Apartment</option>
              <option value="Villa">Villa</option>
            </select>
          </div>

          <div>
            <div className="label">Bedrooms</div>
            <select className="input" value={beds} onChange={(e) => setBeds(Number(e.target.value))}>
              <option value={0}>Studio</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4+</option>
            </select>
          </div>

          <div>
            <div className="label">Size (sq ft)</div>
            <input
              className="input"
              type="number"
              value={sizeSqft}
              onChange={(e) => setSizeSqft(Number(e.target.value))}
              placeholder="e.g. 1250"
            />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={onSubmit} disabled={!isValid || loading}>
            {loading ? "Calculating…" : "Check My Home Value"}
          </button>

          {err ? (
            <div style={{ marginTop: 10 }} className="alert">
              {err}
            </div>
          ) : null}

          <div className="small" style={{ marginTop: 10 }}>
            Apartments · Villas · Dubai (MVP)
          </div>
        </div>
      </div>

      <div className="card cardPad">
        <div className="kpi">
          <div className="kpiVal">How it works</div>
          <div className="kpiSub">
            We show a realistic value range (not a single number) using comparable homes and a
            light size adjustment.
          </div>
        </div>

        <div className="hr" />

        <div className="alert">
          <b>Want a more accurate estimate?</b>
          <br />
          After you see your range, you can request a detailed valuation on WhatsApp by sharing
          floor, view, parking and condition.
        </div>

        <div className="hr" />

        <div className="small">
          Tip: Start with Dubai Marina / Downtown / Business Bay to validate the flow. Then expand
          communities.
        </div>
      </div>
    </div>
  );
}