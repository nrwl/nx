/**
 * GA4 events are routed through GTM via dataLayer (no direct gtag calls here).
 */
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function pushGtmEvent(eventName: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...payload });
}

export function sendPageViewEventViaGtm(data: {
  path?: string;
  title?: string;
}): void {
  pushGtmEvent('page_view', {
    ...(data.path ? { page_path: data.path } : {}),
    ...(data.title ? { page_title: data.title } : {}),
  });
}

export function sendCustomEventViaGtm(
  action: string,
  category: string,
  label: string,
  value?: number,
  customObject?: Record<string, unknown>
): void {
  // Preserve existing GA event names by using the action as the dataLayer event.
  pushGtmEvent(action, {
    event_category: category,
    event_label: label,
    ...(value !== undefined ? { value } : {}),
    ...(customObject ?? {}),
  });
}
