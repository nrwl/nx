// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { autoPluginSidebar } from './src/plugins/auto-plugin-sidebar';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'Nx',
      tagline:
        'An AI-first build platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.',
      favicon: '/favicon.svg',
      plugins: [autoPluginSidebar()],
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
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          autogenerate: { directory: 'getting-started' },
        },
        {
          label: 'API Reference',
          items: [
            // { label: 'Nx CLI', slug: 'api/nx-cli' },
            { label: 'Nx Cloud CLI', slug: 'api/nx-cloud-cli' },
            {
              label: 'Plugins',
              items: [
                { label: 'Overview', slug: 'api/plugins' },
                // Plugins will be dynamically added by the autoPluginSidebar plugin
              ],
            },
          ],
        },
      ],
    }),
  ],

  adapter: netlify(),
});