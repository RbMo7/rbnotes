import type { MetadataRoute } from "next";

const SITE_URL = "https://note.rbmo.xyz";

/**
 * Only the public auth flow belongs here -- everything else in the app is
 * signed-in-only content with nothing for an anonymous crawler to index
 * (see robots.ts). `/reset` is reachable only via a private emailed link,
 * not a page anyone would land on from search, so it's left out too.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/register`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${SITE_URL}/forgot-password`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
