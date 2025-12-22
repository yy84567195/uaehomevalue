import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n.config";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed", // 默认语言不加 /en，其它语言用 /zh /ar /hi /ru
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};