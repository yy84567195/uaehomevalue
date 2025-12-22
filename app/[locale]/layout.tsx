import {NextIntlClientProvider} from "next-intl";
import {getMessages} from "next-intl/server";
import {ReactNode} from "react";

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: {locale: string};
}) {
  const messages = await getMessages({locale: params.locale});

  return (
    <NextIntlClientProvider locale={params.locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}