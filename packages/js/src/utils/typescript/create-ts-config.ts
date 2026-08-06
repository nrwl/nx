import { getTsConfigModuleResolution } from '../is-typescript-version-at-least';
import { Tree, readJson, updateJson, writeJson } from '@nx/devkit';

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

export function getTsConfigBaseOptions(tree: Tree) {
  return {
    ...tsConfigBaseOptions,
    moduleResolution: getTsConfigModuleResolution(tree),
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
