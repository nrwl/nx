/**
 * [Gtag sending data documentation](https://developers.google.com/analytics/devguides/collection/gtagjs/sending-data)
 *
 * [About Events](https://support.google.com/analytics/answer/1033068/about-events)
 */
import { Gtag } from './gtag';

declare const gtag: Gtag;

export function sendPageViewEvent(data: {
  gaId: string;
  path?: string;
  title?: string;
}): void {
  if (process.env.NODE_ENV !== 'production') return;
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
