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
export declare function nxComponentTestingPreset(pathToConfig: string): {
  specPattern: string;
  devServer: ViteDevServer;
  videosFolder: string;
  screenshotsFolder: string;
  chromeWebSecurity: boolean;
};
export {};
//# sourceMappingURL=index.d.ts.map
