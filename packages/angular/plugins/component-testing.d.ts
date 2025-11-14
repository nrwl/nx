import { NxComponentTestingPresetOptions } from '@nx/cypress/plugins/cypress-preset';
/**
 * Angular nx preset for Cypress Component Testing
 *
 * This preset contains the base configuration
 * for your component tests that nx recommends.
 * including a devServer that supports nx workspaces.
 * you can easily extend this within your cypress config via spreading the preset
 * @example
 * export default defineConfig({
 *   component: {
 *     ...nxComponentTestingPreset(__filename)
 *     // add your own config here
 *   }
 * })
 *
 * @param pathToConfig will be used for loading project options and to construct the output paths for videos and screenshots
 * @param options override options
 */
export declare function nxComponentTestingPreset(
  pathToConfig: string,
  options?: NxComponentTestingPresetOptions
): any;
//# sourceMappingURL=component-testing.d.ts.map
