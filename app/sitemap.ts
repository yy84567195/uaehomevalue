import type { MetadataRoute } from "next";
import { locales } from "@/i18n.config";

const baseUrl = "https://www.uaehomevalue.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1.0, freq: "daily" as const },
    { path: "/result", priority: 0.8, freq: "daily" as const },
    { path: "/methodology", priority: 0.6, freq: "monthly" as const },
  ];

  const urls: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const page of pages) {
      const path =
        locale === "en"
          ? `${baseUrl}${page.path}`
          : `${baseUrl}/${locale}${page.path}`;

      urls.push({
        url: path,
        lastModified: new Date(),
        changeFrequency: page.freq,
        priority: page.priority,
      });
    }
  }

  return urls;
}
