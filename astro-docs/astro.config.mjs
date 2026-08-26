// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { sidebar } from './sidebar.mts';
import rehypeTableOptionLinks from './src/plugins/utils/rehype-table-option-links.ts';
import { resolveNxDevUrl } from './src/utils/resolve-nx-dev-url.ts';

// Always resolve NX_DEV_URL so downstream consumers (Footer, Header) pick it up.
// For deploy previews this overrides any site-level env var to point to the matching preview.
process.env.NX_DEV_URL = resolveNxDevUrl();

const BASE = '/docs';

// Set on non-production builds (versioned snapshots, canary) so the archived
// pages don't compete with nx.dev in search results.
const NO_INDEX = process.env.NX_DOCS_NO_INDEX === 'true';

// This is exposed as window.__CONFIG
const PUBLIC_CONFIG = {
  gtmMeasurementId: 'GTM-KW8423B6',
  isProd: process.env.NODE_ENV === 'production',
};

// https://astro.build/config
export default defineConfig({
  base: BASE,
  vite: { plugins: [tailwindcss()] },
  // Allow this to be configured per environment for robots.txt detection
  // Note: this happens during build time so we don't use `import.meta.env`
  site: process.env.NX_DEV_URL ?? 'https://nx.dev',
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: false, // Disable pixel limit
      },
    },
  },
  markdown: {
    rehypePlugins: [rehypeTableOptionLinks],
  },
  trailingSlash: 'never',
  redirects: {
    '/concepts/inferred-tasks': '/docs/concepts/mental-model',
    '/concepts/executors-and-configurations':
      '/docs/kb/executors-and-configurations',
    '/concepts/nx-daemon': '/docs/reference/nx-daemon',
    '/guides/tips-n-tricks/define-environment-variables':
      '/docs/reference/environment-variables#loading-environment-variables',
    '/technologies/angular/guides/use-environment-variables-in-angular':
      '/docs/reference/environment-variables#loading-environment-variables',
    '/technologies/react/guides/use-environment-variables-in-react':
      '/docs/reference/environment-variables#loading-environment-variables',
    '/knowledge-base/installation': '/docs/kb/installation-and-updates',
    '/kb/project-graph-plugins': '/docs/kb/add-language-support',
    '/kb/intro': '/docs/kb/add-language-support',
    '/kb/tooling-plugin': '/docs/kb/add-language-support',
    '/guides/nx-cloud/source-control-integration/github':
      '/docs/features/ci-features/github-integration',
    '/concepts/decisions/overview': '/docs/kb/monorepo-vs-polyrepo',
    '/concepts/decisions/why-monorepos': '/docs/kb/what-is-a-monorepo',
    '/features/maintain-typescript-monorepos':
      '/docs/technologies/typescript/introduction',
    '/guides/nx-cloud/ci-resource-usage':
      '/docs/features/ci-features/resource-usage',
    '/reference/remote-cache-plugins':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/s3-cache':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/s3-cache/overview':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/gcs-cache':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/gcs-cache/overview':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/azure-cache':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/azure-cache/overview':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/shared-fs-cache':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/shared-fs-cache/overview':
      '/docs/reference/deprecated/self-hosted-cache-packages',
    '/reference/remote-cache-plugins/shared-fs-cache/generators':
      '/docs/reference/deprecated/self-hosted-cache-packages',
  },
  // This adapter doesn't support local previews, so only load it on Netlify.
  adapter: process.env['NETLIFY'] ? netlify() : undefined,
  integrations: [
    markdoc(),
    // https://starlight.astro.build/reference/configuration/
    starlight({
      title: 'Nx',
      tagline:
        'Get to green PRs in half the time. Nx optimizes your builds, scales your CI, and fixes failed PRs. Built for developers and AI agents.',
      customCss: ['./src/styles/global.css'],
      favicon: '/favicon.svg',
      logo: {
        light: './src/assets/nx/Nx-dark.png',
        dark: './src/assets/nx/Nx-light.png',
        replacesTitle: true,
      },
      disable404Route: true,
      lastUpdated: true,
      head: [
        ...(NO_INDEX
          ? [
              {
                tag: 'meta',
                attrs: { name: 'robots', content: 'noindex' },
              },
            ]
          : []),
        // PostHog analytics, consent-gated via Cookiebot and served through the
        // first-party reverse proxy. Deliberately code-owned (not in the GTM
        // container) so adblockers that block googletagmanager.com don't also
        // take PostHog down. Loaded before GTM; the hostname guard keeps it
        // inert in dev and preview deploys.
        {
          tag: 'script',
          attrs: { 'data-cookieconsent': 'ignore' },
          content: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.setAttribute("data-cookieconsent","ignore"),p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="an ln init xn Cn Br kn In capture Fn nn calculateEventProperties On register register_once register_for_session unregister unregister_for_session Ln getFeatureFlag getFeatureFlagPayload getFeatureFlagResult getAllFeatureFlags isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync Dn identify setPersonProperties unsetPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset shutdown setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty An Rn createPersonProfile setInternalOrTestUser $n yn jn opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Tn debug Ur Rt getPageViewId captureTraceFeedback captureTraceMetric pn".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

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
}`,
        },
        {
          tag: 'script',
          content: `window.__CONFIG = ${JSON.stringify(PUBLIC_CONFIG)};`,
        },
        {
          tag: 'script',
          attrs: {
            src: `${BASE}/global-scripts.js`,
            defer: true,
          },
        },
      ],
      plugins: [],
      routeMiddleware: [
        // NOTE: this is responsibile for populating the Reference section
        // with generated routes from the nx-reference-packages content collection
        // since the sidebar doesn't auto generate w/ dynamic routes from src/pages/reference
        // only the src/content/docs/reference files
        './src/plugins/sidebar-reference-updater.middleware.ts',
        './src/plugins/og.middleware.ts',
        './src/plugins/github-stars.middleware.ts',
        './src/plugins/raw-content.middleware.ts',
        './src/plugins/canonical.middleware.ts',
        './src/plugins/knowledge-base-layout.middleware.ts',
        './src/plugins/schema.middleware.ts',
      ],
      markdown: {
        headingLinks: true,
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/nrwl/nx' },
        {
          icon: 'youtube',
          label: 'YouTube',
          href: 'https://www.youtube.com/@NxDevtools?utm_source=nx.dev',
        },
        {
          icon: 'x.com',
          label: 'X',
          href: 'https://x.com/NxDevTools?utm_source=nx.dev',
        },
        {
          icon: 'discord',
          label: 'Discord',
          href: 'https://go.nx.dev/community',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/nrwl/nx/tree/main/',
      },
      sidebar,
      components: {
        Header: './src/components/layout/Header.astro',
        Footer: './src/components/layout/Footer.astro',
        PageFrame: './src/components/layout/PageFrame.astro',
        Sidebar: './src/components/layout/Sidebar.astro',
        TwoColumnContent: './src/components/layout/TwoColumnContent.astro',
        PageTitle: './src/components/layout/PageTitle.astro',
        TableOfContents: './src/components/layout/TableOfContents.astro',
      },
      pagefind: {
        ranking: {
          // termFrequency changes the ranking balance between
          // frequency of the term relative to document length
          // versus weighted term count.
          // default is 1.0
          termFrequency: 0.65,
          // pageLength changes the way ranking compares page lengths with the average page lengths on your site.
          // default 0.75
          pageLength: 0.3,
          // termSaturation controls how quickly a term “saturates” on a page.
          // Once a term has appeared on a page many times,
          // further appearances have a reduced impact on the page rank.
          // default: 1.4
          termSaturation: 1.2,
          // termSimilarity changes the ranking based on
          // similarity of terms to the search query.
          // Currently this only takes the length of the term into account.
          // default is 1.0
          // termSimilarity: 1.0,
        },
      },
    }),
    react(),
    sitemap({
      lastmod: new Date(),
    }),
  ],
});
