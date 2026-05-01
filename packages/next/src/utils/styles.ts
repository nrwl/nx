import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';

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

  return extraDependencies
    ? addDependenciesToPackageJson(
        host,
        extraDependencies.dependencies,
        extraDependencies.devDependencies
      )
    : () => {};
}
