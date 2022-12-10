import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, updateJson } from '@nrwl/devkit';
import {
  getRelativePathToRootTsConfig,
  getRootTsConfigPathInTree,
} from '@nrwl/workspace/src/utilities/typescript';
import { NormalizedSchema } from './normalized-schema';
import {
  createTsConfig,
  extractTsConfigBase,
} from '../../utils/create-ts-config';

function updateRootConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  updateJson(host, getRootTsConfigPathInTree(host), (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    delete c.paths[options.name];

    if (c.paths[options.importPath]) {
      throw new Error(
        `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
      );
    }

    c.paths[options.importPath] = [
      joinPathFragments(options.projectRoot, '/src/index.ts'),
    ];

    return json;
  });
}

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
  updateRootConfig(host, options);
  updateProjectConfig(host, options);
  updateProjectIvyConfig(host, options);
}
