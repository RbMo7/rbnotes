import type { MetadataRoute } from "next";

const SITE_URL = "https://note.rbmo.xyz";

/**
 * Everything under /notes, /settings, and /s/<token> is a signed-in user's
 * private content (notes, workspace, shared-note links) -- never fetchable
 * by an anonymous crawler anyway (all three require auth), but disallowed
 * explicitly so no crawler ever tries, and so an accidentally-leaked share
 * link can't end up indexed. Only the public auth flow (login, register,
 * forgot-password) is meant to be found.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/notes", "/settings", "/s/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
