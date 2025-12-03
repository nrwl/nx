/**
 * Shared banner types for nx-dev and astro-docs
 * These types define the structure of the banner JSON that can be consumed from a URL
 */

export type BannerType = 'webinar' | 'event' | 'release';
export type BannerStatus = 'upcoming' | 'live' | 'past';

export interface BannerNotification {
  /** Unique identifier for the banner, used as dismiss key in localStorage */
  id: string;
  /** Title of the event/webinar/release */
  title: string;
  /** Short description */
  description: string;
  /** ISO date string (e.g., "2024-10-07") */
  date: string;
  /** Time of the event (e.g., "10:00 AM ET") */
  time?: string;
  /** Type of notification */
  type: BannerType;
  /** Current status of the event */
  status: BannerStatus;
  /** Primary CTA URL (registration, more info, etc.) */
  url: string;
  /** Optional CTA button text (defaults to type-specific text) */
  ctaText?: string;
  /** Optional secondary links (e.g., watch replay, Discord discussion) */
  links?: BannerLink[];
  /** Whether to show this banner (can be used to disable without removing) */
  enabled?: boolean;
}

export interface BannerLink {
  /** Display text for the link */
  label: string;
  /** URL for the link */
  url: string;
  /** Optional icon identifier */
  icon?: 'play' | 'chat' | 'external';
}

export interface BannerConfig {
  /** List of notifications to display */
  notifications: BannerNotification[];
}

/**
 * Helper to get the active notification from a banner config
 * Returns the first enabled upcoming/live notification, or null if none
 */
export function getActiveBanner(
  config: BannerConfig | null
): BannerNotification | null {
  if (!config?.notifications?.length) {
    return null;
  }

  // Find the first enabled notification that is upcoming or live
  // Trust the status field - if it says "upcoming" or "live", show it
  const active = config.notifications
    .filter((n) => n.enabled !== false)
    .filter((n) => n.status === 'upcoming' || n.status === 'live')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  return active || null;
}

/**
 * Get default CTA text based on banner type
 */
export function getDefaultCtaText(type: BannerType): string {
  switch (type) {
    case 'webinar':
      return 'Register';
    case 'event':
      return 'Learn more';
    case 'release':
      return 'Read more';
  }
}
