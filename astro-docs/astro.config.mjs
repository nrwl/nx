// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import netlify from '@astrojs/netlify';
import linkValidator from 'starlight-links-validator';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import tailwindcss from '@tailwindcss/vite';
import { sidebar } from './sidebar.mts';
import { redirects } from './redirects.mts';

// https://astro.build/config
export default defineConfig({
  vite: { plugins: [tailwindcss()] },
  site: 'https://docs.nx.dev',
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: false, // Disable pixel limit
      },
    },
  },
  // This adapter doesn't support local previews, so only load it on Netlify.
  adapter: process.env['NETLIFY'] ? netlify() : undefined,
  redirects,
  integrations: [
    markdoc(),
    starlight({
      title: 'Nx',
      tagline:
        'An AI-first build platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.',
      customCss: ['./src/styles/global.css'],
      favicon: '/favicon.svg',
      logo: {
        light: './src/assets/nx/Nx-dark.png',
        dark: './src/assets/nx/Nx-light.png',
        replacesTitle: true,
      },
      plugins: [
        // linkValidator(),
      ],
      routeMiddleware: ['./src/plugins/banner.middleware.ts'],
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
