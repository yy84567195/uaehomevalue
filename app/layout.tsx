import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'Dubai Home Value Estimate | Instant Property Price Range – UAEHomeValue',
  description:
    'Check your home value in Dubai instantly. Get a realistic property price range based on nearby market data. Free, independent, no agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics (GA4) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-XM8445334Q"
        />
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
        <div className="container">
          {/* Top Navigation */}
          <div className="nav">
            <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* ✅ Logo */}
              <img
                src="/logo.png"
                alt="UAEHomeValue"
                style={{
                  width: 34,
                  height: 34,
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />

              {/* Brand Text */}
              <div>
                <div style={{ fontWeight: 900 }}>UAEHomeValue</div>
                <div className="small">Dubai · Estimated value ranges</div>
              </div>
            </div>

            <div className="badge">MVP</div>
          </div>

          {/* Page Content */}
          {children}

          {/* Footer */}
          <div className="footer">
            <div className="hr" />
            <div>
              UAEHomeValue provides estimated property value ranges based on publicly available market data and comparable listings.
              All valuations are indicative only and do not constitute an official valuation for legal, mortgage, or financial purposes.
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}