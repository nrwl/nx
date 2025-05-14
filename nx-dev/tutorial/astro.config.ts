import tutorialkit from '@tutorialkit/astro';
import { defineConfig, envField } from 'astro/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { runInTerminalPlugin } from './src/code-block-button/run-in-terminal-plugin';
import { applyFileChangesPlugin } from './src/code-block-button/apply-file-changes-plugin';

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
        HeadTags: './src/components/HeadTags.astro',
        TopBar: './src/components/TopBar.astro',
      },
      defaultRoutes: 'tutorial-only',
      expressiveCodePlugins: [runInTerminalPlugin(), applyFileChangesPlugin()],
    }),
  ],
});

export default config;
