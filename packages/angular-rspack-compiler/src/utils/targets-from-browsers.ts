/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

export function transformSupportedBrowsersToTargets(
  supportedBrowsers: string[]
): string[] {
  const transformed: string[] = [];

  // https://esbuild.github.io/api/#target
  const esBuildSupportedBrowsers = new Set([
    'chrome',
    'edge',
    'firefox',
    'ie',
    'ios',
    'node',
    'opera',
    'safari',
  ]);

  for (const browser of supportedBrowsers) {
    let [browserName, version] = browser.toLowerCase().split(' ');

    if (version == null) {
      throw new Error(`Invalid browser version in: ${browser}`);
    }
    // browserslist uses the name `ios_saf` for iOS Safari whereas esbuild uses `ios`
    if (browserName === 'ios_saf') {
      browserName = 'ios';
    }

    // browserslist uses ranges `15.2-15.3` versions but only the lowest is required
    // to perform minimum supported feature checks. esbuild also expects a single version.
    [version] = version.split('-');

    if (esBuildSupportedBrowsers.has(browserName)) {
      if (browserName === 'safari' && version === 'tp') {
        // esbuild only supports numeric versions so `TP` is converted to a high number (999) since
        // a Technology Preview (TP) of Safari is assumed to support all currently known features.
        version = '999';
      } else if (!version.includes('.')) {
        // A lone major version is considered by esbuild to include all minor versions. However,
        // browserslist does not and is also inconsistent in its `.0` version naming. For example,
        // Safari 15.0 is named `safari 15` but Safari 16.0 is named `safari 16.0`.
        version += '.0';
      }

      transformed.push(browserName + version);
    }
  }

  return transformed;
}
