import type { Tree } from '@nx/devkit';
import { updateJson } from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { NormalizedSchema } from './normalized-schema';
import {
  createTsConfig,
  extractTsConfigBase,
} from '../../utils/create-ts-config';

function updateProjectConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  updateJson(host, `${options.projectRoot}/tsconfig.lib.json`, (json) => {
    json.include = ['src/**/*.ts'];
    json.exclude = [
      ...new Set([
        ...(json.exclude || []),
        'jest.config.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ]),
    ];
    return json;
  });

  // tsconfig.json
  createTsConfig(
    host,
    options.projectRoot,
    'lib',
    options,
    getRelativePathToRootTsConfig(host, options.projectRoot)
  );
}

function updateProjectIvyConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.buildable || options.publishable) {
    return updateJson(
      host,
      `${options.projectRoot}/tsconfig.lib.prod.json`,
      (json) => {
        json.angularCompilerOptions['compilationMode'] =
          options.compilationMode === 'full' ? undefined : 'partial';
        return json;
      }
    );
  }
}

export function updateTsConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  extractTsConfigBase(host);
  updateProjectConfig(host, options);
  updateProjectIvyConfig(host, options);
}
