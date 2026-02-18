import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function MethodologyPage({
  params,
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale: params.locale });
  const locale = params.locale;

  const sections = [
    {
      title: "How Estimates Are Calculated",
      body: `UAEHomeValue generates a price range estimate based on community-level and area-level pricing data derived from Dubai Land Department (DLD) open transaction records.

The estimate follows this logic:
1. Match your inputs (area, community, property type, bedrooms) to the closest available data range.
2. If a community-level match exists, it is used first — this gives a tighter, more accurate range.
3. If no community data is available, we fall back to the area-level range.
4. The range is adjusted for the size you entered using a price-per-sqft factor, compressed logarithmically to avoid extreme swings.
5. A confidence level (High / Medium / Low) is assigned based on the quality of the match.`,
    },
    {
      title: "Data Sources",
      body: `All pricing data is derived from official open data published by UAE government bodies:

Dubai:
• Dubai Land Department (DLD) — Residential sale transaction records, freehold units. Available at dubailand.gov.ae/en/open-data/real-estate-data/
• Dubai Pulse — DLD Residential Sale Index (monthly/quarterly/yearly). Available at dubaipulse.gov.ae/organisation/dld
• DLD Ejari Rent Contracts — Tenancy contract data used for rental yield calculation. Available at dubaipulse.gov.ae

Abu Dhabi:
• DARI Platform (DMT / ADRES) — Official Abu Dhabi real estate transaction data and market insights. Available at dari.ae/en/realestate-data
• ADREC Dashboards — Abu Dhabi Real Estate Centre price indices and transaction analytics. Available at adrec.gov.ae

Data is used under open data terms. No proprietary or commercial data feeds are used.`,
    },
    {
      title: "Rental Yield Reference",
      body: `The rental estimates are derived from area-level rental data sourced from DLD Ejari tenancy contracts (Dubai) and DARI rental indices (Abu Dhabi). Rental ranges reflect the typical annual rent for the selected area, property type, and bedroom count.

Gross rental yield is calculated as: (Annual Rent / Property Value) × 100%. Yields typically range from 4–8% across UAE markets.

These figures are indicative references. Always verify against current rental listings before making investment decisions.`,
    },
    {
      title: "What the Estimate Does Not Account For",
      body: `The estimate does not adjust for:
• Specific floor level within a building
• Exact view (sea-facing, city-facing, road-facing)
• Interior condition or renovation level
• Parking allocation
• Specific building within a community

The "Improve Accuracy" feature on the result page allows you to input these factors, which narrows the range using predefined adjustment heuristics.`,
    },
    {
      title: "Update Frequency",
      body: `Price range data is reviewed and updated periodically, targeting monthly updates to track DLD open data releases. The last update date is shown in the data metadata.

Trend data displayed on result pages is derived from the estimate + index signals, not from a live data feed. It is indicative only.`,
    },
    {
      title: "Disclaimer",
      body: `UAEHomeValue provides estimated property value ranges for informational purposes only. These estimates:
• Are not official property valuations
• Are not suitable for mortgage, legal or financial purposes
• May differ from actual market prices at the time of transaction
• Are based on aggregated market data and do not reflect individual property condition

For an official valuation, consult a RERA-licensed valuer or Dubai Land Department registered valuation firm.`,
    },
  ];

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 20px 60px",
        color: "var(--text-primary)",
      }}
    >
      {/* Back link */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href={`/${locale}`}
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ← Back
        </Link>
      </div>

      {/* Header */}
      <h1
        style={{
          fontSize: "clamp(24px, 4vw, 36px)",
          fontWeight: 950,
          letterSpacing: -0.5,
          margin: "0 0 8px",
        }}
      >
        {t("dataSource.methodologyLink")}
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "0 0 36px", lineHeight: 1.6 }}>
        How UAEHomeValue calculates property estimates, where the data comes from, and what the limitations are.
      </p>

      {/* Data source trust badges */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 36,
          padding: "16px 18px",
          background: "rgba(255,255,255,.04)",
          border: "1px solid var(--border)",
          borderRadius: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: "100%", marginBottom: 4 }}>
          Official data sources used:
        </div>
        {[
          {
            name: "Dubai Land Department",
            url: "https://dubailand.gov.ae/en/open-data/real-estate-data/",
            label: "Open data · Sales & Rent transactions",
          },
          {
            name: "Dubai Pulse",
            url: "https://www.dubaipulse.gov.ae/organisation/dld",
            label: "Open data · DLD & DSC price indices",
          },
        ].map((src) => (
          <a
            key={src.name}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              flexDirection: "column",
              gap: 2,
              padding: "10px 14px",
              background: "rgba(59,130,246,.08)",
              border: "1px solid rgba(59,130,246,.25)",
              borderRadius: 10,
              textDecoration: "none",
              minWidth: 200,
              flex: "1 1 200px",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 900, color: "var(--text-primary)" }}>{src.name} ↗</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{src.label}</span>
          </a>
        ))}
      </div>

      {/* Sections */}
      <div style={{ display: "grid", gap: 28 }}>
        {sections.map((s) => (
          <div
            key={s.title}
            style={{
              padding: "20px 22px",
              background: "rgba(255,255,255,.03)",
              border: "1px solid var(--border)",
              borderRadius: 14,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 950, margin: "0 0 12px", color: "var(--text-primary)" }}>
              {s.title}
            </h2>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.8,
                color: "var(--text-secondary)",
                whiteSpace: "pre-line",
              }}
            >
              {s.body}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div
        style={{
          marginTop: 36,
          fontSize: 11,
          color: "var(--text-muted)",
          lineHeight: 1.7,
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
        }}
      >
        {t("footer.dataCredit")} · {t("footer.copy")}
      </div>
    </div>
  );
}
