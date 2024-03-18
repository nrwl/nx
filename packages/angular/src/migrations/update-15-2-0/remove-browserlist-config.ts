import type { Tree } from '@nx/devkit';
import { logger, visitNotIgnoredFiles } from '@nx/devkit';
import { basename } from 'path';

const validBrowserslistConfigFilenames = new Set([
  'browserslist',
  '.browserslistrc',
]);

export const DEFAULT_BROWSERS = [
  'last 1 Chrome version',
  'last 1 Firefox version',
  'last 2 Edge major versions',
  'last 2 Safari major versions',
  'last 2 iOS major versions',
  'Firefox ESR',
];

export default async function removeBrowserlistConfig(tree: Tree) {
  let browserslist: any;

  try {
    browserslist = await import('browserslist');
  } catch {
    logger.warn(
      'Skipping migration because the "browserslist" package could not be loaded.'
    );

    return;
  }

  // Set the defaults to match the defaults in build-angular.
  browserslist.defaults = DEFAULT_BROWSERS;

  const defaultSupportedBrowsers = new Set(browserslist(DEFAULT_BROWSERS));
  const es5Browsers = new Set(browserslist(['supports es6-module']));

  visitNotIgnoredFiles(tree, '/', (path) => {
    const fileName = basename(path);
    if (
      !validBrowserslistConfigFilenames.has(fileName) ||
      path.startsWith('node_modules')
    ) {
      return;
    }

    const { defaults: browsersListConfig, ...otherConfigs } =
      browserslist.parseConfig(tree.read(path, 'utf-8'));

    if (Object.keys(otherConfigs).length) {
      // The config contains additional sections.
      return;
    }

    const browserslistInProject = browserslist(
      // Exclude from the list ES5 browsers which are not supported.
      browsersListConfig.map((s) => `${s} and supports es6-module`),
      {
        ignoreUnknownVersions: true,
      }
    );

    if (defaultSupportedBrowsers.size !== browserslistInProject.length) {
      return;
    }

    const shouldDelete = browserslistInProject.every((browser) =>
      defaultSupportedBrowsers.has(browser)
    );

    if (shouldDelete) {
      // All browsers are the same as the default config.
      // Delete file as it's redundant.
      tree.delete(path);
    }
  });
}
