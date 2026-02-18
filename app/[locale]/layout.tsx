import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n.config";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function getBaseUrl() {
  // ✅ 你上线域名放这里（推荐在 Vercel/服务器环境变量配置）
  // NEXT_PUBLIC_SITE_URL=https://uaehomevalue.com
  const v = process.env.NEXT_PUBLIC_SITE_URL;
  if (v && v.startsWith("http")) return v.replace(/\/$/, "");
  return "https://uaehomevalue.com"; // TODO: 改成你的真实域名
}

function seoByLocale(locale: Locale) {
  // ✅ 不依赖 messages 文件，避免你现在又要去改一堆 json
  const map: Record<Locale, { title: string; description: string }> = {
    en: {
      title: "Dubai Home Value Estimate | Instant Property Price Range – UAEHomeValue",
      description:
        "Check your home value in Dubai instantly. Get a realistic property price range based on nearby market data. Free, independent, no agents.",
    },
    ar: {
      title: "تقدير سعر العقار في دبي فورًا | UAEHomeValue",
      description:
        "اعرف قيمة منزلك في دبي فورًا. احصل على نطاق سعري واقعي بناءً على بيانات السوق القريبة. مجاني ومستقل وبدون وسطاء.",
    },
    hi: {
      title: "दुबई में घर की कीमत का अनुमान | UAEHomeValue",
      description:
        "दुबई में अपने घर की कीमत तुरंत जानें। आसपास के बाज़ार डेटा पर आधारित वास्तविक मूल्य रेंज पाएं। मुफ्त, स्वतंत्र, बिना एजेंट।",
    },
    zh: {
      title: "迪拜房产估值｜即时价格区间 – UAEHomeValue",
      description:
        "快速查看你在迪拜的房产价值区间。基于附近市场数据给出更真实的价格范围。免费、独立、无中介。",
    },
    ru: {
      title: "Оценка недвижимости в Дубае | UAEHomeValue",
      description:
        "Узнайте стоимость недвижимости в Дубае мгновенно. Реалистичный ценовой диапазон на основе рыночных данных. Бесплатно, независимо, без агентов.",
    },
  };

  return map[locale] ?? map.en;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = params.locale as Locale;
  if (!locales.includes(locale)) notFound();

  const baseUrl = getBaseUrl();
  const seo = seoByLocale(locale);

  // ✅ hreflang / canonical 由 Next.js metadata 自动输出
  const languages: Record<string, string> = {
    en: `${baseUrl}/`,
    ar: `${baseUrl}/ar`,
    hi: `${baseUrl}/hi`,
    zh: `${baseUrl}/zh`,
    ru: `${baseUrl}/ru`,
  };

  const canonical =
    locale === "en" ? `${baseUrl}/` : `${baseUrl}/${locale}`;

  return {
    metadataBase: new URL(baseUrl),
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonical,
      siteName: "UAEHomeValue",
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const locale = params.locale as Locale;
  // locale is used in the nav link above

  // 兜底：非法 locale 直接 404（避免运行时报错）
  if (!locales.includes(locale)) notFound();

  const messages = await getMessages({ locale });

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="container">
            {/* Top Navigation */}
            <div
              className="nav"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              {/* Brand */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src="/logo.png"
                  alt="UAEHomeValue"
                  style={{
                    width: 34,
                    height: 34,
                    objectFit: "contain",
                    borderRadius: 8,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 900 }}>UAEHomeValue</div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                    Estimate first · Decide better
                  </div>
                </div>
              </div>

              {/* Right */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <a
                  href={`/${locale}/methodology`}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Methodology
                </a>
                <LanguageSwitcher />
              </div>
            </div>

            {children}

            {/* Footer */}
            <div
              className="footer"
              style={{
                marginTop: 40,
                fontSize: 12,
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginBottom: 8 }}>
                <a href={`/${locale}/methodology`} style={{ color: "#64748b", textDecoration: "none", fontWeight: 700 }}>Methodology</a>
                <span style={{ color: "#334155" }}>Data: Dubai Land Department (open data)</span>
                <span>© {new Date().getFullYear()} UAEHomeValue</span>
              </div>
              UAEHomeValue provides estimated property value ranges based on publicly available market
              data. All valuations are indicative only and do not constitute an official valuation
              for legal, mortgage, or financial purposes.
            </div>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}