import tutorialkit from '@tutorialkit/astro';
import { defineConfig } from 'astro/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export const config = defineConfig({
  devToolbar: {
    enabled: false,
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
