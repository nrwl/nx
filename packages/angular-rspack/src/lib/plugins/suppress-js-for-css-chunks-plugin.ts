import { Compiler, NormalModule, RspackPluginInstance } from '@rspack/core';

export class SuppressJsForCssOnlyEntryPlugin implements RspackPluginInstance {
  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(
      'SuppressJsForCssOnlyEntryPlugin',
      (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'SuppressJsForCssOnlyEntryPlugin',
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
          },
          (_) => {
            for (const chunk of compilation.chunks) {
              const cssFiles = [...chunk.files].filter((f) =>
                f.endsWith('.css')
              );
              const jsFiles = [...chunk.files].filter((f) => f.endsWith('.js'));

              // Only act if chunk has CSS and a single JS file
              if (cssFiles.length > 0 && jsFiles.length === 1) {
                const jsAssetName = jsFiles[0];
                const asset = compilation.getAsset(jsAssetName);

                if (!asset) continue;

                const entryModules =
                  compilation.chunkGraph.getChunkEntryModulesIterable(chunk);

                const cssOnly = Array.from(entryModules).every((module) => {
                  const extensions = ['.css', '.scss', '.sass', '.less'];
                  return extensions.some((ext) =>
                    (
                      module as NormalModule
                    ).resourceResolveData?.path?.endsWith(ext)
                  );
                });

                if (cssOnly) {
                  compilation.deleteAsset(jsAssetName);
                }
              }
            }
          }
        );
      }
    );
  }
}
