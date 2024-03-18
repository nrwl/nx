import { nxBaseCypressPreset } from '@nx/cypress/plugins/cypress-preset';
import { joinPathFragments, workspaceRoot } from '@nx/devkit';

import { existsSync } from 'fs';
import { dirname, join } from 'path';

type ViteDevServer = {
  framework: 'react';
  bundler: 'vite';
  viteConfig?: any;
};

/**
 * Remix nx preset for Cypress Component Testing
 *
 * This preset contains the base configuration
 * for your component tests that nx recommends.
 * including a devServer that supports nx workspaces.
 * you can easily extend this within your cypress config via spreading the preset
 * @example
 * export default defineConfig({
 *   component: {
 *     ...nxComponentTestingPreset(__dirname)
 *     // add your own config here
 *   }
 * })
 *
 * @param pathToConfig will be used for loading project options and to construct the output paths for videos and screenshots
 */
export function nxComponentTestingPreset(pathToConfig: string): {
  specPattern: string;
  devServer: ViteDevServer;
  videosFolder: string;
  screenshotsFolder: string;
  chromeWebSecurity: boolean;
} {
  const normalizedProjectRootPath = ['.ts', '.js'].some((ext) =>
    pathToConfig.endsWith(ext)
  )
    ? pathToConfig
    : dirname(pathToConfig);

  return {
    ...nxBaseCypressPreset(pathToConfig),
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    devServer: {
      ...({ framework: 'react', bundler: 'vite' } as const),
      viteConfig: async () => {
        const viteConfigPath = findViteConfig(normalizedProjectRootPath);

        const { mergeConfig, loadConfigFromFile, searchForWorkspaceRoot } =
          await import('vite');

        const resolved = await loadConfigFromFile(
          {
            mode: 'watch',
            command: 'serve',
          },
          viteConfigPath
        );
        return mergeConfig(resolved.config, {
          server: {
            fs: {
              allow: [
                searchForWorkspaceRoot(normalizedProjectRootPath),
                workspaceRoot,
                joinPathFragments(workspaceRoot, 'node_modules/vite'),
              ],
            },
          },
        });
      },
    },
  };
}

function findViteConfig(projectRootFullPath: string): string {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (existsSync(join(projectRootFullPath, `vite.config.${ext}`))) {
      return join(projectRootFullPath, `vite.config.${ext}`);
    }
  }
}
