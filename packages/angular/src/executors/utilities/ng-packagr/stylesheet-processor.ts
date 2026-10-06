/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Add the project root to the search directories.
 */

import { workspaceRoot } from '@nx/devkit';
import browserslist from 'browserslist';
import { ComponentStylesheetBundler } from 'ng-packagr/src/lib/styles/component-stylesheets';
import {
  generateSearchDirectories,
  getTailwindConfig,
  loadPostcssConfiguration,
} from 'ng-packagr/src/lib/styles/postcss-configuration';
import type { NgPackageEntryConfig } from 'ng-packagr/src/ng-entrypoint.schema';
import { getNgPackagrVersionInfo } from './ng-packagr-version';

export enum CssUrl {
  inline = 'inline',
  none = 'none',
}

export function getStylesheetProcessor(): new (
  projectBasePath: string,
  basePath: string,
  cssUrl?: CssUrl,
  includePaths?: string[],
  sass?: NgPackageEntryConfig['lib']['sass'],
  cacheDirectory?: string | false,
  watch?: boolean
) => {
  [key: string]: any;
} {
  const { major: ngPackagrMajorVersion } = getNgPackagrVersionInfo();

  class StylesheetProcessor extends ComponentStylesheetBundler {
    constructor(
      protected readonly projectBasePath: string,
      protected readonly basePath: string,
      protected readonly cssUrl?: CssUrl,
      protected readonly includePaths?: string[],
      protected readonly sass?: NgPackageEntryConfig['lib']['sass'],
      protected readonly cacheDirectory?: string | false,
      protected readonly watch?: boolean
    ) {
      if (ngPackagrMajorVersion === 22) {
        browserslist.defaults = ['baseline widely available on 2026-05-07'];
      } else if (ngPackagrMajorVersion === 21) {
        browserslist.defaults = ['baseline widely available on 2025-10-20'];
      } else if (ngPackagrMajorVersion === 20) {
        (browserslist.defaults as string[]) = browserslist(undefined, {
          path: require.resolve('ng-packagr/.browserslistrc'),
        });
      }

      const browserslistData = browserslist(undefined, { path: basePath });
      let searchDirs = generateSearchDirectories([projectBasePath]);
      const postcssConfiguration = loadPostcssConfiguration(searchDirs);
      // (nx-specific): we support loading the TailwindCSS config from the root of the workspace
      searchDirs = generateSearchDirectories([projectBasePath, workspaceRoot]);

      super(
        {
          cacheDirectory: cacheDirectory,
          postcssConfiguration: postcssConfiguration,
          tailwindConfiguration: postcssConfiguration
            ? undefined
            : getTailwindConfig(searchDirs, projectBasePath),
          sass: sass as any,
          workspaceRoot: projectBasePath,
          cssUrl: cssUrl,
          target: transformSupportedBrowsersToTargets(browserslistData),
          includePaths: includePaths,
        },
        'css',
        watch
      );
    }

    destroy(): void {
      void super.dispose();
    }
  }

  return StylesheetProcessor;
}

function transformSupportedBrowsersToTargets(
  supportedBrowsers: string[]
): string[] {
  const transformed: string[] = [];

  // https://esbuild.github.io/api/#target
  const esBuildSupportedBrowsers = new Set([
    'safari',
    'firefox',
    'edge',
    'chrome',
    'ios',
  ]);

  for (const browser of supportedBrowsers) {
    let [browserName, version] = browser.split(' ');

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
      }

      transformed.push(browserName + version);
    }
  }

  return transformed.length ? transformed : undefined;
}
