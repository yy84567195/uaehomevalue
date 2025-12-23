import "./globals.css";
import Script from "next/script";
import type { ReactNode } from "react";

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
      <body>{children}</body>
    </html>
  );
}