import tutorialkit from '@tutorialkit/astro';
import { defineConfig, envField } from 'astro/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export const config = defineConfig({
  base: '/tutorials',
  devToolbar: {
    enabled: false,
  },
  experimental: {
    env: {
      schema: {
        NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: envField.string({
          context: 'client',
          access: 'public',
          optional: true,
        }),
        NEXT_PUBLIC_FARO_URL: envField.string({
          context: 'client',
          access: 'public',
          optional: true,
        }),
        NEXT_PUBLIC_VERCEL_ENV: envField.string({
          context: 'client',
          access: 'public',
          optional: true,
        }),
      },
    },
  },
  vite: {
    plugins: [nxViteTsPaths() as any],
    ssr: {
      noExternal: [
        '@tutorialkit/astro',
        '@astrojs/mdx',
        '@astrojs/react',
        'astro-expressive-code',
      ],
    },
  },
  integrations: [
    tutorialkit({
      components: {
        TopBar: './src/components/TopBar.astro',
      },
    }),
  ],
});

export default config;
