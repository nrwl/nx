// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import tailwindcss from '@tailwindcss/vite';
import { sidebar } from './sidebar.mts';

const BASE = '/docs';

const PUBLIC_CONFIG = {
  cookiebotDisabled: process.env.COOKIEBOT_DISABLED === 'true',
  cookiebotId: process.env.COOKIEBOT_ID ?? null,
  gaMeasurementId: 'UA-88380372-10',
  gtmMeasurementId: 'GTM-KW8423B6',
  isProd: process.env.NODE_ENV === 'production',
};

// https://astro.build/config
export default defineConfig({
  base: BASE,
  vite: { plugins: [tailwindcss()] },
  // Allow this to be configured per environment
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
  trailingSlash: 'never',
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
      head: [
        {
          tag: 'script',
          content: `window.__CONFIG = ${JSON.stringify(PUBLIC_CONFIG)};`,
        },
        ...(process.env.COOKIEBOT_ID &&
        process.env.COOKIEBOT_DISABLED !== 'true'
          ? [
              {
                /** @type {"script"} */
                tag: 'script',
                attrs: {
                  id: 'Cookiebot',
                  src: 'https://consent.cookiebot.com/uc.js',
                  'data-cbid': process.env.COOKIEBOT_ID,
                  'data-blockingmode': 'auto',
                  type: 'text/javascript',
                },
              },
            ]
          : []),
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
        './src/plugins/banner.middleware.ts',
        // NOTE: this is responsibile for populating the Reference section
        // with generated routes from the nx-reference-packages content collection
        // since the sidebar doesn't auto generate w/ dynamic routes from src/pages/reference
        // only the src/content/docs/reference files
        './src/plugins/sidebar-reference-updater.middleware.ts',
        './src/plugins/sidebar-icons.middleware.ts',
        './src/plugins/og.middleware.ts',
      ],
      markdown: {
        // this breaks the renderMarkdown function in the plugin loader due to starlight path normalization
        // as to _why_ it has to normalize a path?
        // idk just working around the issue for now but we'll want to have linked headers so will need to fix
        headingLinks: false,
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
      },
    }),
    react(),
  ],
});
