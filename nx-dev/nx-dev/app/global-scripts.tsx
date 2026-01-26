'use client';
import Script from 'next/script';
import { useEffect } from 'react';

declare global {
  interface Window {
    Cookiebot?: any;
    CookiebotDialog?: any;
    dataLayer?: any;
    gtag?: any;
    hbspt?: any;
    trackingFunctions?: any;
    hj?: any;
    twq?: any;
  }
}

export default function GlobalScripts({ gaMeasurementId, gtmMeasurementId }) {
  // Don't load analytics scripts in development
  const isProduction = process.env.NODE_ENV === 'production';
  const isCookiebotDisabled =
    process.env.NEXT_PUBLIC_COOKIEBOT_DISABLE === 'true';

  useEffect(() => {
    if (!isProduction) return;

    const loadGoogleAnalytics = () => {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
      script.async = true;
      document.head.appendChild(script);

      // Initialize gtag
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', gaMeasurementId, {
        page_path: window.location.pathname,
      });
    };

    const loadGTM = () => {
      if (!gtmMeasurementId) return;

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
    };

    const loadHubSpot = () => {
      const hsScript = document.createElement('script');
      hsScript.src = 'https://js.hs-scripts.com/2757427.js';
      hsScript.async = true;
      hsScript.defer = true;
      document.head.appendChild(hsScript);

      // Load HubSpot Forms
      const hsFormsScript = document.createElement('script');
      hsFormsScript.src = '//js.hsforms.net/forms/v2.js';
      hsFormsScript.async = true;
      hsFormsScript.defer = true;
      document.head.appendChild(hsFormsScript);

      // Load Calendly Forms
      const calendlyFormsScript = document.createElement('script');
      calendlyFormsScript.src =
        '//assets.calendly.com/assets/external/forms.js';
      calendlyFormsScript.async = true;
      calendlyFormsScript.defer = true;
      document.head.appendChild(calendlyFormsScript);

      // Load Calendly CSS
      const calendlyStylesLink = document.createElement('link');
      calendlyStylesLink.href =
        'https://assets.calendly.com/assets/external/widget.css';
      calendlyStylesLink.rel = 'stylesheet';
      calendlyStylesLink.type = 'text/css';
      document.head.appendChild(calendlyStylesLink);
    };

    const loadApollo = () => {
      const n = Math.random().toString(36).substring(7);
      const script = document.createElement('script');
      script.src = `https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache=${n}`;
      script.async = true;
      script.defer = true;
      script.onload = function () {
        if (window.trackingFunctions?.onLoad) {
          window.trackingFunctions.onLoad({
            appId: '65e1db2f1976f30300fd8b26',
          });
        }
      };
      document.head.appendChild(script);
    };

    const loadHotjar = () => {
      (function (h, o, t, j, a, r) {
        h.hj =
          h.hj ||
          function () {
            (h.hj.q = h.hj.q || []).push(arguments);
          };
        // @ts-ignore
        h._hjSettings = { hjid: 2774127, hjsv: 6 };
        a = o.getElementsByTagName('head')[0];
        r = o.createElement('script');
        r.async = 1;
        // @ts-ignore
        r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
        a.appendChild(r);
      })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=');
    };

    const loadTwitterPixel = () => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      !(function (e, t, n, s, u, a) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        e.twq ||
          ((s = e.twq =
            function () {
              s.exe ? s.exe.apply(s, arguments) : s.queue.push(arguments);
            }),
          (s.version = '1.1'),
          (s.queue = []),
          (u = t.createElement(n)),
          (u.async = !0),
          (u.src = 'https://static.ads-twitter.com/uwt.js'),
          (a = t.getElementsByTagName(n)[0]),
          a.parentNode.insertBefore(u, a));
      })(window, document, 'script');
      window.twq('config', 'obtp4');
    };

    const checkAndLoadScripts = () => {
      if (isCookiebotDisabled) {
        loadGoogleAnalytics();
        loadGTM();
        loadHubSpot();
      } else if (window.Cookiebot && window.Cookiebot.consent) {
        // Statistics cookies (Google Analytics, GTM)
        if (window.Cookiebot.consent.statistics) {
          loadGoogleAnalytics();
          loadGTM();
        }

        // Marketing cookies (HubSpot, Apollo, Hotjar, Twitter)
        if (window.Cookiebot.consent.marketing) {
          loadHubSpot();
          loadApollo();
          loadHotjar();
          loadTwitterPixel();
        }
      } else {
        setTimeout(checkAndLoadScripts, 100);
      }
    };

    // Listen for user consent to cookies
    window.addEventListener('CookiebotOnAccept', checkAndLoadScripts);
    checkAndLoadScripts();

    return () => {
      window.removeEventListener('CookiebotOnAccept', checkAndLoadScripts);
    };
  }, [isProduction, gaMeasurementId, gtmMeasurementId]);

  if (!isProduction) {
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
