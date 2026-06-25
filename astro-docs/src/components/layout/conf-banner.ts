// Time-boxed promo bar for the Polygraph Product Hunt launch.
// Build-time gated: the next rebuild after `activeUntil` drops the banner.
export const confBanner = {
  url: 'https://www.producthunt.com/products/polygraph',
  // End of June 25 2026, ET (UTC-4).
  activeUntil: '2026-06-26T04:00:00Z',
};

export function isConfBannerActive(now: Date = new Date()): boolean {
  return now < new Date(confBanner.activeUntil);
}
