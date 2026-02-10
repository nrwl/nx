(function () {
  // Open search modal if signaled via sessionStorage (e.g., from Cmd+K on non-docs pages)
  var SEARCH_STORAGE_KEY = 'nx-open-search';
  var SEARCH_EXPIRY_MS = 30000; // 30 seconds

  function openSearchFromStorage() {
    var timestamp = sessionStorage.getItem(SEARCH_STORAGE_KEY);
    if (!timestamp) return;

    // Clear immediately to prevent re-triggering
    sessionStorage.removeItem(SEARCH_STORAGE_KEY);

    // Check if expired (older than 30 seconds)
    var age = Date.now() - parseInt(timestamp, 10);
    if (age > SEARCH_EXPIRY_MS) return;

    var openSearchBtn = document.querySelector('button[data-open-modal]');
    if (openSearchBtn) {
      openSearchBtn.click();
      // Focus the search input after modal opens
      setTimeout(function () {
        var searchInput = document.querySelector('dialog[open] input');
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    }
  }

  // Check on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openSearchFromStorage);
  } else {
    // Small delay to ensure search component is initialized
    setTimeout(openSearchFromStorage, 100);
  }

  const config = window.__CONFIG || {};
  if (!config.isProd) return;

  const gtmMeasurementId = config.gtmMeasurementId ?? 'GTM-KW8423B6';

  window.dataLayer = window.dataLayer || [];

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

  // GA4 events are dispatched via GTM dataLayer.
  const pushGtmEvent = (eventName, payload) => {
    window.dataLayer.push({ event: eventName, ...payload });
  };

  // Scroll depth tracking
  const SCROLL_THRESHOLDS = [10, 25, 50, 75, 90];
  let firedThresholds = new Set();
  let scrollTrackingEnabled = false;
  let scrollRafId = null;

  function getScrollPercentage() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    return (scrollTop + clientHeight) / scrollHeight;
  }

  function handleScrollTracking() {
    if (!scrollTrackingEnabled) return;

    const scrollPercentage = getScrollPercentage() * 100;

    // Fire events for all thresholds we've passed but haven't fired yet
    for (const threshold of SCROLL_THRESHOLDS) {
      if (scrollPercentage >= threshold && !firedThresholds.has(threshold)) {
        firedThresholds.add(threshold);
        sendSearchEvent(`scroll_${threshold}`, {
          event_category: 'scroll',
          event_label: window.location.pathname,
        });
      }
    }
  }

  function throttledScrollHandler() {
    if (scrollRafId !== null) return;

    scrollRafId = requestAnimationFrame(() => {
      handleScrollTracking();
      scrollRafId = null;
    });
  }

  function attachScrollListener() {
    window.addEventListener('scroll', throttledScrollHandler, {
      passive: true,
    });
  }

  function setupScrollTracking() {
    // Reset scroll depth on navigation (for SPA-like behavior via View Transitions)
    firedThresholds = new Set();
    scrollTrackingEnabled = false;

    // Delay tracking start to avoid false triggers during navigation
    setTimeout(() => {
      scrollTrackingEnabled = true;
      // Immediately check current scroll position to capture thresholds
      // that may have been passed during the delay
      handleScrollTracking();
    }, 500);

    attachScrollListener();

    // Handle Astro View Transitions - reset on navigation
    document.addEventListener('astro:after-swap', () => {
      firedThresholds = new Set();
      scrollTrackingEnabled = false;
      setTimeout(() => {
        scrollTrackingEnabled = true;
        // Immediately check current scroll position after navigation
        handleScrollTracking();
      }, 500);
    });
  }

  const SEARCH_DEBOUNCE_MS = 1000;
  let searchDebounceTimer;
  let lastSearchQuery = '';
  let currentSearchInput = null;
  let inputHandler = null;

  function sendSearchEvent(eventType, data) {
    pushGtmEvent(eventType, data);
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

  const initializeAnalytics = () => {
    if (!gtmMeasurementId) return;
    loadGTM();
    setupSearchTracking();
    setupScrollTracking();
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

  // Initial check
  initializeAnalytics();

  // Add GTM noscript on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addGTMNoScript);
  } else {
    addGTMNoScript();
  }
})();
