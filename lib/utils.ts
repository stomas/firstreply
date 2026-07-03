/**
 * Tiny className joiner. Keeps component markup readable without pulling in
 * an extra dependency for such a small job.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Resolve the public site URL from env, with a safe localhost fallback.
 * Used for SEO metadata, sitemap and robots.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
