'use client';
import { useEffect } from 'react';

export default function GlobalScripts({
  gtmMeasurementId,
}: {
  gtmMeasurementId?: string;
}) {
  // Don't load analytics scripts in development
  const isProduction = process.env.NODE_ENV === 'production';

  useEffect(() => {
    if (!isProduction || !gtmMeasurementId) return;

    // Load GTM only; all analytics/marketing tags are managed in the container.
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s),
        dl = l != 'dataLayer' ? '&l=' + l : '';
      // @ts-ignore
      j.async = true;
      // @ts-ignore
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', gtmMeasurementId);
  }, [isProduction, gtmMeasurementId]);

  if (!isProduction || !gtmMeasurementId) {
    return null;
  }

  return (
    <>
      {/* Google Tag Manager - NoScript fallback (for users without JS) */}
      {gtmMeasurementId && (
        <noscript>
          <iframe
            title="Google Tag Manager"
            src={`https://www.googletagmanager.com/ns.html?id=${gtmMeasurementId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      )}
    </>
  );
}
