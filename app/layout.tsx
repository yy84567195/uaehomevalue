import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export const metadata: Metadata = {
  title: "Dubai Home Value Estimate | Instant Property Price Range – UAEHomeValue",
  description:
    "Check your home value in Dubai instantly. Get a realistic property price range based on nearby market data. Free, independent, no agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics (GA4) */}
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-XM8445334Q" />
        <Script id="ga4" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XM8445334Q');
          `}
        </Script>
      </head>

      <body>
        <div style={{ minHeight: "100vh" }}>
          {/* Top bar */}
          <div
            style={{
              maxWidth: 980,
              margin: "0 auto",
              padding: "18px 16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {/* Left: Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/logo.png"
                alt="UAEHomeValue"
                style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 8 }}
              />
              <div>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>UAEHomeValue</div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                  Dubai · Estimated value ranges
                </div>
              </div>
            </div>

            {/* Right: Language + MVP */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LanguageSwitcher />
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#f1f5f9",
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                }}
              >
                MVP
              </div>
            </div>
          </div>

          {/* Page content */}
          <div style={{ maxWidth: 980, margin: "0 auto", padding: "16px 16px 40px" }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}