// PostHog analytics, consent-gated via Cookiebot and served through the
// first-party reverse proxy. Deliberately code-owned (not in the GTM
// container) so adblockers that block googletagmanager.com don't also
// take PostHog down. Loaded before GTM; the hostname guard keeps it
// inert in dev and preview deploys. Rendered inline (with
// data-cookieconsent="ignore") in both the pages-router _document and
// the app-router root layout.
export const POSTHOG_SNIPPET = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.setAttribute("data-cookieconsent","ignore"),p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="an ln init xn Cn Br kn In capture Fn nn calculateEventProperties On register register_once register_for_session unregister unregister_for_session Ln getFeatureFlag getFeatureFlagPayload getFeatureFlagResult getAllFeatureFlags isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync Dn identify setPersonProperties unsetPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset shutdown setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty An Rn createPersonProfile setInternalOrTestUser $n yn jn opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Tn debug Ur Rt getPageViewId captureTraceFeedback captureTraceMetric pn".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

// Only run on the production hostname (inert in dev/preview)
var h = window.location.hostname;
if (h === "nx.dev") {
  posthog.init('phc_eTmACxF0EKeNRjAZbfpdszbHYumyKhWqsIpMU4Wi53c', {
    api_host: 'https://pha-prx.ops.cloud.nx.app',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    cookieless_mode: 'on_reject',
  });

  // Sync PostHog consent state with Cookiebot.
  // Cookiebot is delivered via the GTM container (GTM-KW8423B6);
  // data-cookieconsent="ignore" above is inert with GTM delivery (no
  // auto-blocking) but protects against a future inline Cookiebot setup.
  // Guards ensure state transitions (and the "Opt in" event) fire once
  // per genuine consent change, not on every page load.
  var syncConsent = function () {
    if (window.Cookiebot && Cookiebot.consent && Cookiebot.consent.statistics) {
      if (!posthog.has_opted_in_capturing()) {
        posthog.opt_in_capturing();
      }
    } else if (!posthog.has_opted_out_capturing()) {
      posthog.opt_out_capturing();
    }
  };

  // OnAccept/OnDecline fire both on the consent click and on every page
  // load for returning visitors with stored consent, so these two cover
  // new choices and returning sessions alike.
  window.addEventListener('CookiebotOnAccept', syncConsent);
  window.addEventListener('CookiebotOnDecline', syncConsent);

  // Fallback: if Cookiebot never loads (adblocker kills GTM), treat as
  // declined — counts the user via the anonymous cookieless hash, stores
  // nothing client-side. Cookiebot-present-but-unclicked stays pending,
  // so the banner flow remains authoritative.
  setTimeout(function () {
    if (!window.Cookiebot && posthog.get_explicit_consent_status && posthog.get_explicit_consent_status() === 'pending') {
      posthog.opt_out_capturing();
    }
  }, 3000);
}`;
