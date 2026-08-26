import {
  addDependenciesToPackageJson,
  detectPackageManager,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';

import { sassVersion } from './versions';

const nextSpecificStyleDependencies = {
  css: {
    dependencies: {},
    devDependencies: {},
  },
  scss: {
    dependencies: {},
    devDependencies: { sass: sassVersion },
  },
};

export function addStyleDependencies(
  host: Tree,
  options: { style?: string; swc?: boolean }
): GeneratorCallback {
  const extraDependencies = nextSpecificStyleDependencies[options.style];

  if (options.style === 'scss') {
    // sass pulls in @parcel/watcher, whose install script only builds from
    // source when npm_config_build_from_source is set.
    acknowledgeBuildScripts(host, detectPackageManager(host.root), {
      '@parcel/watcher': false,
    });
  }

  return extraDependencies
    ? addDependenciesToPackageJson(
        host,
        extraDependencies.dependencies,
        extraDependencies.devDependencies,
        undefined,
        true
      )
    : () => {};
}
