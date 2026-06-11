// Time-boxed promo bar for the "AI <3 Monorepos" online conference.
// Build-time gated: the next rebuild after `activeUntil` drops the banner.
export const confBanner = {
  url: 'https://monorepo.tools/conf?utm_campaign=2026%20Conferences&utm_source=nx-docs&utm_medium=banner',
  // End of June 23 2026, ET (UTC-4).
  activeUntil: '2026-06-24T04:00:00Z',
};

export function isConfBannerActive(now: Date = new Date()): boolean {
  return now < new Date(confBanner.activeUntil);
}
