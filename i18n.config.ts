export const locales = ["en", "ar", "zh", "ru", "hi"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
