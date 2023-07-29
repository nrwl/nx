import { Tree } from 'nx/src/generators/tree';
import * as shared from '@nx/js/src/utils/typescript/create-ts-config';
import { updateJson, writeJson } from 'nx/src/generators/utils/json';

export function createTsConfig(
  host: Tree,
  projectRoot: string,
  type: 'app' | 'lib',
  options: {
    strict?: boolean;
    style?: string;
    bundler?: string;
    rootProject?: boolean;
    unitTestRunner?: string;
  },
  relativePathToRootTsConfig: string
) {
  const json = {
    compilerOptions: {
      jsx: 'react-jsx',
      allowJs: false,
      esModuleInterop: false,
      allowSyntheticDefaultImports: true,
      strict: options.strict,
    },
    files: [],
    include: [],
    references: [
      {
        path: type === 'app' ? './tsconfig.app.json' : './tsconfig.lib.json',
      },
    ],
  } as any;

  if (options.style === '@emotion/styled') {
    json.compilerOptions.jsxImportSource = '@emotion/react';
  }

  if (options.bundler === 'vite') {
    json.compilerOptions.types =
      options.unitTestRunner === 'vitest'
        ? ['vite/client', 'vitest']
        : ['vite/client'];
  }

  // inline tsconfig.base.json into the project
  if (options.rootProject) {
    json.compileOnSave = false;
    json.compilerOptions = {
      ...shared.tsConfigBaseOptions,
      ...json.compilerOptions,
    };
    json.exclude = ['node_modules', 'tmp'];
  } else {
    json.extends = relativePathToRootTsConfig;
  }

  writeJson(host, `${projectRoot}/tsconfig.json`, json);

  const tsconfigProjectPath = `${projectRoot}/tsconfig.${type}.json`;
  if (options.bundler === 'vite' && host.exists(tsconfigProjectPath)) {
    updateJson(host, tsconfigProjectPath, (json) => {
      json.compilerOptions ??= {};

      const types = new Set(json.compilerOptions.types ?? []);
      types.add('node');
      types.add('vite/client');

      json.compilerOptions.types = Array.from(types);

      return json;
    });
  }
}

export function extractTsConfigBase(host: Tree) {
  shared.extractTsConfigBase(host);

  if (host.exists('vite.config.ts')) {
    const vite = host.read('vite.config.ts').toString();
    host.write(
      'vite.config.ts',
      vite.replace(`projects: []`, `projects: ['tsconfig.base.json']`)
    );
  }
}
