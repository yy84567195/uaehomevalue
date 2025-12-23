import type { MetadataRoute } from "next";
import { locales } from "@/i18n.config";

const baseUrl = "https://www.uaehomevalue.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "",
    "/result",
  ];

  const urls: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const page of pages) {
      const path =
        locale === "en"
          ? `${baseUrl}${page}`
          : `${baseUrl}/${locale}${page}`;

      urls.push({
        url: path,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: page === "" ? 1 : 0.8,
      });
    }
  }

  return urls;
}