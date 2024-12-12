import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
  toJS,
  writeJson,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { NormalizedSchema } from '../schema';
import { createTsConfig } from '../../../utils/create-ts-config';

export function createLibraryFiles(host: Tree, options: NormalizedSchema) {
  const relativePathToRootTsConfig = getRelativePathToRootTsConfig(
    host,
    options.projectRoot
  );
  const substitutions = {
    ...options,
    ...names(options.name),
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    fileName: options.fileName,
  };

  generateFiles(
    host,
    joinPathFragments(__dirname, '../files'),
    options.projectRoot,
    substitutions
  );

  if (
    !options.isUsingTsSolutionConfig &&
    (options.publishable || options.bundler !== 'none')
  ) {
    writeJson(host, joinPathFragments(options.projectRoot, 'package.json'), {
      name: options.name,
      version: '0.0.1',
      main: './index.js',
      types: './index.d.ts',
      exports: {
        '.': {
          import: './index.mjs',
          require: './index.js',
          types: './index.d.ts',
        },
      },
    });
  }

  if (options.unitTestRunner !== 'vitest') {
    host.delete(`${options.projectRoot}/tsconfig.spec.json`);
  }

  if (options.js) {
    toJS(host);
  }

  createTsConfig(
    host,
    options.projectRoot,
    'lib',
    options,
    relativePathToRootTsConfig
  );
}
