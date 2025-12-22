import {getRequestConfig} from "next-intl/server";
import {locales, defaultLocale, type Locale} from "../i18n.config";

const loadMessages: Record<Locale, () => Promise<{default: any}>> = {
  en: () => import("../messages/en.json"),
  ar: () => import("../messages/ar.json"),
  zh: () => import("../messages/zh.json"),
  hi: () => import("../messages/hi.json"),
  ru: () => import("../messages/ru.json"),
};

export default getRequestConfig(async ({locale}) => {
  const safeLocale: Locale =
    locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;

  return {
    locale: safeLocale, // ✅ 关键：必须返回 locale
    messages: (await loadMessages[safeLocale]()).default
  };
});
