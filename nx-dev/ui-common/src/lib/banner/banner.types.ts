/**
 * Shared banner types for nx-dev and astro-docs
 * These types define the structure of the banner JSON that can be consumed from a URL
 */

/**
 * Banner configuration - single banner at a time
 * JSON Schema:
 * {
 *   "title": "Event Title",
 *   "description": "Event description",
 *   "primaryCtaUrl": "https://nx.dev/",
 *   "primaryCtaText": "Learn More",
 *   "secondaryCtaUrl": "https://nx.dev/register",
 *   "secondaryCtaText": "Register Now",
 *   "enabled": true
 * }
 */
export interface BannerConfig {
  /** Title of the banner */
  title: string;
  /** Short description */
  description: string;
  /** Primary CTA URL */
  primaryCtaUrl: string;
  /** Primary CTA button text */
  primaryCtaText: string;
  /** Secondary CTA URL (optional) */
  secondaryCtaUrl?: string;
  /** Secondary CTA button text (optional) */
  secondaryCtaText?: string;
  /** Whether to show this banner */
  enabled: boolean;
}

/**
 * Validate and return the banner config if valid, null otherwise
 */
export function validateBannerConfig(data: unknown): BannerConfig | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const config = data as Record<string, unknown>;

  // Required fields
  if (
    typeof config.title !== 'string' ||
    typeof config.description !== 'string' ||
    typeof config.primaryCtaUrl !== 'string' ||
    typeof config.primaryCtaText !== 'string' ||
    typeof config.enabled !== 'boolean'
  ) {
    return null;
  }

  // Optional fields validation
  if (
    config.secondaryCtaUrl !== undefined &&
    typeof config.secondaryCtaUrl !== 'string'
  ) {
    return null;
  }
  if (
    config.secondaryCtaText !== undefined &&
    typeof config.secondaryCtaText !== 'string'
  ) {
    return null;
  }

  return config as unknown as BannerConfig;
}
