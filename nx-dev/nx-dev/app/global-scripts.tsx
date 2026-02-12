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

    const w = window as typeof window & { __hsbtLoaded?: boolean };
    if (w.__hsbtLoaded) return;
    w.__hsbtLoaded = true;

    const ensureScript = (id: string, src: string) => {
      if (document.getElementById(id)) return;
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    };

    const ensureStylesheet = (id: string, href: string) => {
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.href = href;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      document.head.appendChild(link);
    };

    // Load HubSpot + forms and Calendly assets once.
    ensureScript('hs-script', 'https://js.hs-scripts.com/2757427.js');
    ensureScript('hs-forms-script', 'https://js.hsforms.net/forms/v2.js');
    ensureScript(
      'calendly-forms-script',
      'https://assets.calendly.com/assets/external/forms.js'
    );
    ensureStylesheet(
      'calendly-widget-style',
      'https://assets.calendly.com/assets/external/widget.css'
    );

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
