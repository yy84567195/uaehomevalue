import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'UAEHomeValue — Dubai Home Value Estimate',
  description: 'Check your home value in Dubai — instantly. Free price estimate range based on nearby market data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <div className="nav">
            <div className="brand">
              <span style={{display:'inline-block', width:34, height:34, borderRadius:10, background:'rgba(88,166,255,.25)', border:'1px solid rgba(88,166,255,.35)'}} />
              <div>
                <div>UAEHomeValue</div>
                <div className="small">Dubai · Estimated value ranges</div>
              </div>
            </div>
            <div className="badge">MVP</div>
          </div>
          {children}
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
