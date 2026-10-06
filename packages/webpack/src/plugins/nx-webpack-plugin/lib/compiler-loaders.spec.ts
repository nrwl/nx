import { createLoaderFromCompiler } from './compiler-loaders';
import { NormalizedNxAppWebpackPluginOptions } from '../nx-app-webpack-plugin-options';

describe('createLoaderFromCompiler tsc', () => {
  function tscOptions(): NormalizedNxAppWebpackPluginOptions {
    return {
      root: '/test',
      tsConfig: 'apps/test/tsconfig.app.json',
      compiler: 'tsc',
      transformers: [],
    } as unknown as NormalizedNxAppWebpackPluginOptions;
  }

  // ts-loader 9.5.7+ forwards the tsconfig rootDir to transpileModule, so
  // workspace lib sources resolved outside the app rootDir fail with TS6059.
  // The loader must widen rootDir to the workspace root to keep those builds green.
  it('should widen ts-loader rootDir to the workspace root', () => {
    const rule = createLoaderFromCompiler(tscOptions());

    expect(rule.options.compilerOptions).toEqual({ rootDir: '/test' });
  });
});
