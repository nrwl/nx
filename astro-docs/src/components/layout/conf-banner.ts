// Time-boxed promo bar for the Nx product event (Oct 22 2026).
// Build-time gated: the next rebuild after `activeUntil` drops the banner.
export const confBanner = {
  url: 'https://nx.dev/events/2026-oct-product-event?utm_source=docs&utm_medium=banner#register',
  // End of Oct 22 2026, ET (UTC-4).
  activeUntil: '2026-10-23T04:00:00Z',
};

export function isConfBannerActive(now: Date = new Date()): boolean {
  return now < new Date(confBanner.activeUntil);
}
