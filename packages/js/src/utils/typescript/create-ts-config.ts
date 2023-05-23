import { Tree } from 'nx/src/generators/tree';
import { readJson, updateJson, writeJson } from 'nx/src/generators/utils/json';

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
  baseUrl: '.',
  paths: {},
};

export function extractTsConfigBase(host: Tree) {
  if (host.exists('tsconfig.base.json')) return;

  const tsconfig = readJson(host, 'tsconfig.json');
  const baseCompilerOptions = {} as any;

  for (let compilerOption of Object.keys(tsConfigBaseOptions)) {
    baseCompilerOptions[compilerOption] =
      tsconfig.compilerOptions[compilerOption];
    delete tsconfig.compilerOptions[compilerOption];
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
