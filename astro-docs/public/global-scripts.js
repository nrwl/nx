(function () {
  const config = window.__CONFIG || {};
  if (!config.isProd) return;

  const isCookiebotDisabled = config.cookiebotDisabled ?? false;
  const gaMeasurementId = config.gaMeasurementId ?? 'UA-88380372-10';
  const gtmMeasurementId = config.gtmMeasurementId ?? 'GTM-KW8423B6';

  // Initialize global objects
  window.Cookiebot = window.Cookiebot || {};
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };

  const loadGoogleAnalytics = () => {
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
    script.async = true;
    document.head.appendChild(script);

    // Initialize gtag
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
      j.async = true;
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
      h._hjSettings = { hjid: 2774127, hjsv: 6 };
      a = o.getElementsByTagName('head')[0];
      r = o.createElement('script');
      r.async = 1;
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      a.appendChild(r);
    })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=');
  };

  const loadTwitterPixel = () => {
    !(function (e, t, n, s, u, a) {
      e.twq ||
        ((s = e.twq =
          function () {
            s.exe ? s.exe.apply(s, arguments) : s.queue.push(arguments);
          }),
        (s.version = '1.1'),
        (s.queue = []),
        (u = t.createElement(n)),
        (u.async = !0),
        (u.src = 'https://static.ads-x.com/uwt.js'),
        (a = t.getElementsByTagName(n)[0]),
        a.parentNode.insertBefore(u, a));
    })(window, document, 'script');
    window.twq('config', 'obtp4');
  };

  const SEARCH_DEBOUNCE_MS = 1000;
  let searchDebounceTimer;
  let lastSearchQuery = '';
  let currentSearchInput = null;
  let inputHandler = null;

  function sendSearchEvent(eventType, data) {
    if (typeof window.gtag !== 'undefined')
      window.gtag('event', eventType, data);
  }

  function trackSearchQuery(query) {
    if (!query || query === lastSearchQuery) return;

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      lastSearchQuery = query;
      sendSearchEvent('search_query', {
        query: query,
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  function setupSearchTracking() {
    const observer = new MutationObserver(() => {
      const searchDialog = document.querySelector(
        'dialog[open] .search-container'
      );
      // If dialog is found, then set up tracking
      if (searchDialog) {
        if (currentSearchInput && inputHandler) return; // Already tracking
        const searchInput = searchDialog.querySelector(
          'input[type="search"], input[type="text"]'
        );
        if (searchInput) {
          inputHandler = (e) => {
            const query = e.target.value.trim();
            trackSearchQuery(query);
          };
          searchInput.addEventListener('input', inputHandler);
          currentSearchInput = searchInput;
        }
      }
      // If dialog is not found but we have handler, etc. then it must be closed and we should clean up
      else if (currentSearchInput && inputHandler) {
        currentSearchInput.removeEventListener('input', inputHandler);
        currentSearchInput = null;
        inputHandler = null;
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
  }

  const checkAndLoadScripts = () => {
    if (isCookiebotDisabled) {
      loadGoogleAnalytics();
      loadGTM();
      loadHubSpot();
      setupSearchTracking();
    } else if (window.Cookiebot && window.Cookiebot.consent) {
      // Statistics cookies (Google Analytics, GTM, Search Tracking)
      if (window.Cookiebot.consent.statistics) {
        loadGoogleAnalytics();
        loadGTM();
        setupSearchTracking();
      }

      // Marketing cookies (HubSpot, Apollo, Hotjar, Twitter)
      if (window.Cookiebot.consent.marketing) {
        loadHubSpot();
        loadApollo();
        loadHotjar();
        loadTwitterPixel();
      }
    } else {
      // Wait for Cookiebot to load
      setTimeout(checkAndLoadScripts, 100);
    }
  };

  // Add GTM noscript iframe to body
  const addGTMNoScript = () => {
    const noscript = document.createElement('noscript');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmMeasurementId}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    iframe.title = 'Google Tag Manager';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);
  };

  // Listen for user consent to cookies
  window.addEventListener('CookiebotOnAccept', checkAndLoadScripts);

  // Initial check
  checkAndLoadScripts();

  // Add GTM noscript on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addGTMNoScript);
  } else {
    addGTMNoScript();
  }
})();
