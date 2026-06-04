import { Tree } from 'nx/src/generators/tree';
import { readJson, updateJson, writeJson } from 'nx/src/generators/utils/json';
import { isTypescriptVersionAtLeast } from '../is-typescript-version-at-least';

export const tsConfigBaseOptions = {
  rootDir: '.',
  sourceMap: true,
  declaration: false,
  moduleResolution: 'node',
  emitDecoratorMetadata: true,
  experimentalDecorators: true,
  importHelpers: true,
  target: 'es2015',
  module: 'esnext',
  lib: ['es2020', 'dom'],
  skipLibCheck: true,
  skipDefaultLibCheck: true,
  // TS 6.0 flips the `strict` default to true; pin false to keep this base
  // config's behavior identical on TS 5.8 and 6.0.
  strict: false,
  paths: {},
};

// node-family moduleResolution errors on TS 6 (TS5107) and bundler+commonjs
// errors on TS 5 (TS5095); resolve it per the declared TypeScript version.
export function getTsConfigBaseOptions(tree: Tree) {
  return {
    ...tsConfigBaseOptions,
    moduleResolution: isTypescriptVersionAtLeast(tree, '6.0.0')
      ? 'bundler'
      : 'node10',
  };
}

export function extractTsConfigBase(host: Tree) {
  if (host.exists('tsconfig.base.json')) return;

  const tsconfig = readJson(host, 'tsconfig.json');
  const baseCompilerOptions = {} as any;

  if (tsconfig.compilerOptions) {
    for (let compilerOption of Object.keys(tsConfigBaseOptions)) {
      baseCompilerOptions[compilerOption] =
        tsconfig.compilerOptions[compilerOption];
      delete tsconfig.compilerOptions[compilerOption];
    }
  }
  writeJson(host, 'tsconfig.base.json', {
    compileOnSave: false,
    compilerOptions: baseCompilerOptions,
    exclude: tsconfig.exclude,
  });
  tsconfig.extends = './tsconfig.base.json';
  delete tsconfig.compileOnSave;
  delete tsconfig.exclude;

  writeJson(host, 'tsconfig.json', tsconfig);

  // special case for updating e2e tests.
  if (host.exists('e2e/tsconfig.json')) {
    updateJson(host, 'e2e/tsconfig.json', (json) => {
      json.extends = '../tsconfig.base.json';
      return json;
    });
  }
}
