"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

const LOCALES = ["en", "ar", "zh", "hi", "ru"] as const;
type Locale = (typeof LOCALES)[number];

export default function LanguageSwitcher() {
  const t = useTranslations("lang");
  const locale = useLocale() as Locale;

  const router = useRouter();
  const pathname = usePathname() || "/";

  function stripLocalePrefix(path: string) {
    for (const l of LOCALES) {
      if (path === `/${l}`) return "/";
      if (path.startsWith(`/${l}/`)) return path.slice(`/${l}`.length);
    }
    return path;
  }

  function buildPath(nextLocale: Locale) {
    const base = stripLocalePrefix(pathname);
    if (nextLocale === "en") return base;
    return `/${nextLocale}${base === "/" ? "" : base}`;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>{t("label")}</div>

      <select
        value={locale}
        onChange={(e) => router.push(buildPath(e.target.value as Locale))}
        style={{
          border: "1px solid #e2e8f0",
          background: "#fff",
          padding: "8px 10px",
          borderRadius: 12,
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        <option value="en">{t("en")}</option>
        <option value="ar">{t("ar")}</option>
        <option value="hi">{t("hi")}</option>
        <option value="zh">{t("zh")}</option>
        <option value="ru">{t("ru")}</option>
      </select>
    </div>
  );
}