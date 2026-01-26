import { Compiler, RspackPluginInstance } from '@rspack/core';

export class RxjsEsmResolutionPlugin implements RspackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap(
      'RxJSEsmResolution',
      (normalModuleFactory) => {
        normalModuleFactory.hooks.resolve.tap('RxJSEsmResolution', (data) => {
          if (data.request.startsWith('rxjs')) {
            data.request = data.request.replace(
              /([\\/]dist[\\/])cjs([\\/])/,
              '$1esm$2'
            );
          }
        });
      }
    );
  }
}
