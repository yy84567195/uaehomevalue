import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n.config";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const locale = params.locale as Locale;

  // 非法 locale 直接 404
  if (!locales.includes(locale)) notFound();

  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* ✅ 在嵌套 layout 里不要再写 html/body，用 div 控制方向即可 */}
      <div dir={locale === "ar" ? "rtl" : "ltr"}>{children}</div>
    </NextIntlClientProvider>
  );
}