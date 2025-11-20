/**
 * [Gtag sending data documentation](https://developers.google.com/analytics/devguides/collection/gtagjs/sending-data)
 *
 * [About Events](https://support.google.com/analytics/answer/1033068/about-events)
 */
import { Gtag } from './gtag';

declare const gtag: Gtag;

declare global {
  interface Window {
    Cookiebot?: any;
  }
}

export function sendPageViewEvent(data: {
  gaId: string;
  path?: string;
  title?: string;
}): void {
  if (process.env.NODE_ENV !== 'production') return;

  // Check if user has consented to statistics cookies
  if (
    // Browswer only
    typeof window !== 'undefined' &&
    // Disabled for Astro
    !window.__CONFIG?.disableCookiebot &&
    // Disabled for Next.js
    typeof process === 'object' &&
    process.env.NEXT_PUBLIC_COOKIEBOT_DISABLE !== 'true' &&
    // Cookiebot
    window.Cookiebot &&
    !window.Cookiebot.consent?.statistics
  ) {
    return;
  }

  // Check if gtag is available (might not be loaded yet if consent was just given)
  if (typeof gtag === 'undefined') {
    return;
  }

  try {
    gtag('config', data.gaId, {
      ...(!!data.path && { page_path: data.path }),
      ...(!!data.title && { page_title: data.title }),
    });
  } catch (exception) {
    throw new Error(`Cannot send Google Tag event: ${exception}`);
  }
}

export function sendCustomEvent(
  action: string,
  category: string,
  label: string,
  value?: number,
  customObject?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== 'production') return;

  // Check if user has consented to statistics cookies
  if (
    // Browswer only
    typeof window !== 'undefined' &&
    // Disabled for Astro
    !window.__CONFIG?.disableCookiebot &&
    // Disabled for Next.js
    typeof process === 'object' &&
    process.env.NEXT_PUBLIC_COOKIEBOT_DISABLE !== 'true' &&
    // Cookiebot
    window.Cookiebot &&
    !window.Cookiebot.consent?.statistics
  ) {
    return;
  }

  // Check if gtag is available (might not be loaded yet if consent was just given)
  if (typeof gtag === 'undefined') {
    return;
  }

  try {
    gtag('event', action, {
      event_category: category,
      event_label: label,
      value,
      ...customObject,
    });
  } catch (error) {
    throw new Error(`Cannot send Google Tag event: ${error}`);
  }
}
