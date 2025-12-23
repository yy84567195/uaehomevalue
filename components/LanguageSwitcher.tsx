"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

const LOCALES = ["en", "ar", "hi", "zh", "ru"] as const;
type Locale = (typeof LOCALES)[number];

function detectLocaleFromPath(pathname: string): Locale {
  const first = pathname.split("/")[1] || "";
  return (LOCALES as readonly string[]).includes(first) ? (first as Locale) : "en";
}

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const currentLocale = useMemo(() => detectLocaleFromPath(pathname), [pathname]);

  function buildTargetPath(nextLocale: Locale) {
    // 拆掉当前 locale 前缀
    const parts = pathname.split("/").filter(Boolean);
    const first = parts[0];
    const hasLocale = (LOCALES as readonly string[]).includes(first);

    const rest = hasLocale ? parts.slice(1) : parts;
    const basePath = rest.length ? `/${rest.join("/")}` : "/";

    // 你的策略：en 不加 /en；其它加 /zh /ar /hi /ru
    const withLocale =
      nextLocale === "en"
        ? basePath
        : `/${nextLocale}${basePath === "/" ? "" : basePath}`;

    // ✅ 保留 query（只在客户端存在）
    const qs = typeof window !== "undefined" ? window.location.search : "";
    return `${withLocale}${qs || ""}`;
  }

  return (
    <select
      value={currentLocale}
     onChange={(e) => {
  const nextLocale = e.target.value as Locale;

  // ✅ 切换语言时写入 cookie，保证 default(en) 也能稳定生效
  document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; SameSite=Lax; Max-Age=31536000`;

  router.replace(buildTargetPath(nextLocale), { scroll: false });
}}
      style={{
        height: 32,
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        padding: "0 10px",
        background: "#fff",
        fontSize: 12,
        fontWeight: 800,
        color: "#0f172a",
        cursor: "pointer",
      }}
      aria-label="Language"
    >
      <option value="en">EN</option>
      <option value="ar">AR</option>
      <option value="hi">HI</option>
      <option value="zh">中文</option>
      <option value="ru">RU</option>
    </select>
  );
}