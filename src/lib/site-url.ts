/**
 * The app's real public origin -- a single source of truth for anything
 * that builds an absolute URL server-side (page metadata, robots.txt,
 * sitemap.xml, and password-reset emails). `NEXT_PUBLIC_SITE_URL` can
 * override it for local/staging testing, but production has no such env
 * var set, so the default here must be the real deployed domain, never
 * localhost -- a password-reset link that falls back to localhost is
 * unreachable for a real user.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://note.rbmo.xyz";
