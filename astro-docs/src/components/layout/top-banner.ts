export function isBannerActive(
  activeUntil: string | undefined,
  now: Date = new Date()
): boolean {
  return !!activeUntil && now < new Date(activeUntil);
}

export function withUtmSource(url: string, source: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('utm_source', source);
    return parsed.toString();
  } catch {
    return url;
  }
}
