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
      title: "Dubai & Abu Dhabi Property Value Estimate | Free Home Price Range – UAEHomeValue",
      description:
        "Instantly estimate your property value in Dubai and Abu Dhabi. Get a realistic price range and rental yield based on DLD and DARI official data. Free tool, no agents, no login.",
    },
    ar: {
      title: "تقدير قيمة العقار في دبي وأبوظبي فورًا | UAEHomeValue",
      description:
        "اعرف قيمة عقارك في دبي وأبوظبي فورًا. نطاق سعري واقعي بناءً على بيانات DLD و DARI الرسمية. أداة مجانية بدون وسطاء.",
    },
    hi: {
      title: "दुबई और अबू धाबी संपत्ति मूल्य अनुमान | UAEHomeValue",
      description:
        "दुबई और अबू धाबी में अपनी संपत्ति का मूल्य तुरंत जानें। DLD और DARI आधिकारिक डेटा पर आधारित। मुफ्त, बिना एजेंट।",
    },
    zh: {
      title: "迪拜和阿布扎比房产估值｜免费价格区间工具 – UAEHomeValue",
      description:
        "即时估算你在迪拜和阿布扎比的房产价值。基于 DLD 和 DARI 官方数据，提供真实价格区间和租金回报率。免费工具，无中介。",
    },
    ru: {
      title: "Оценка недвижимости в Дубае и Абу-Даби | UAEHomeValue",
      description:
        "Мгновенная оценка стоимости недвижимости в Дубае и Абу-Даби. Данные DLD и DARI. Бесплатно, без агентов.",
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "UAEHomeValue",
    url: getBaseUrl(),
    description: seoByLocale(locale).description,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "AED" },
    provider: {
      "@type": "Organization",
      name: "UAEHomeValue",
      url: getBaseUrl(),
    },
    areaServed: [
      { "@type": "City", name: "Dubai", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
      { "@type": "City", name: "Abu Dhabi", containedInPlace: { "@type": "Country", name: "United Arab Emirates" } },
    ],
    featureList: "Property valuation, Rental yield estimation, Market data, PDF report download",
  };

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
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