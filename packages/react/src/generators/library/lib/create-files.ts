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

export function createFiles(host: Tree, options: NormalizedSchema) {
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
    joinPathFragments(__dirname, '../files/common'),
    options.projectRoot,
    substitutions
  );

  if (options.bundler === 'vite' || options.unitTestRunner === 'vitest') {
    generateFiles(
      host,
      joinPathFragments(__dirname, '../files/vite'),
      options.projectRoot,
      substitutions
    );
  }

  if (options.compiler === 'babel') {
    writeJson(host, joinPathFragments(options.projectRoot, '.babelrc'), {
      presets: [
        [
          '@nx/react/babel',
          {
            runtime: 'automatic',
            useBuiltIns: 'usage',
            importSource:
              options.style === '@emotion/styled'
                ? '@emotion/react'
                : undefined,
          },
        ],
      ],
      plugins: [
        options.style === 'styled-components'
          ? ['styled-components', { pure: true, ssr: true }]
          : undefined,
        options.style === 'styled-jsx' ? 'styled-jsx/babel' : undefined,
        options.style === '@emotion/styled'
          ? '@emotion/babel-plugin'
          : undefined,
      ].filter(Boolean),
    });
  }

  if (!options.publishable && !options.buildable) {
    host.delete(`${options.projectRoot}/package.json`);
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
