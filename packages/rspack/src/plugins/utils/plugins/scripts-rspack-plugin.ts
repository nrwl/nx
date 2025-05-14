import { interpolateName } from 'loader-utils';
import * as path from 'path';
import {
  sources,
  EntryPlugin,
  type Compiler,
  type Compilation,
} from '@rspack/core';

export interface ScriptsRspackPluginOptions {
  name: string;
  sourceMap: boolean;
  scripts: string[];
  filename: string;
  basePath: string;
}

interface ScriptOutput {
  filename: string;
  source: sources.Source;
}

function addDependencies(compilation: any, scripts: string[]): void {
  for (const script of scripts) {
    compilation.fileDependencies.add(script);
  }
}

function hook(
  compiler: any,
  action: (compilation: any, callback: (err?: Error) => void) => void
) {
  compiler.hooks.thisCompilation.tap(
    'scripts-rspack-plugin',
    (compilation: any) => {
      compilation.hooks.additionalAssets.tapAsync(
        'scripts-rspack-plugin',
        (callback: (err?: Error) => void) => action(compilation, callback)
      );
    }
  );
}

export class ScriptsRspackPlugin {
  private _lastBuildTime?: number;
  private _cachedOutput?: ScriptOutput;

  constructor(private options: Partial<ScriptsRspackPluginOptions> = {}) {}

  private _insertOutput(
    compiler: Compiler,
    compilation: Compilation,
    { filename, source }: ScriptOutput,
    cached = false
  ) {
    new EntryPlugin(compiler.context, this.options.name).apply(compiler);

    compilation.assets[filename] = source;
  }

  apply(compiler: Compiler): void {
    if (!this.options.scripts || this.options.scripts.length === 0) {
      return;
    }

    const scripts = this.options.scripts
      .filter((script) => !!script)
      .map((script) => path.resolve(this.options.basePath || '', script));

    hook(compiler, (compilation: Compilation, callback) => {
      const sourceGetters = scripts.map((fullPath) => {
        return new Promise<sources.Source>((resolve, reject) => {
          compilation.inputFileSystem.readFile(
            fullPath,
            (err: Error, data: Buffer) => {
              if (err) {
                reject(err);
                return;
              }

              const content = data.toString();

              let source;
              if (this.options.sourceMap) {
                // TODO: Look for source map file (for '.min' scripts, etc.)

                let adjustedPath = fullPath;
                if (this.options.basePath) {
                  adjustedPath = path.relative(this.options.basePath, fullPath);
                }
                source = new sources.OriginalSource(content, adjustedPath);
              } else {
                source = new sources.RawSource(content);
              }

              resolve(source);
            }
          );
        });
      });

      Promise.all(sourceGetters)
        .then((_sources) => {
          const concatSource = new sources.ConcatSource();
          _sources.forEach((source) => {
            concatSource.add(source);
            concatSource.add('\n;');
          });

          const combinedSource = new sources.CachedSource(concatSource);
          const filename = interpolateName(
            { resourcePath: 'scripts.js' },
            this.options.filename as string,
            { content: combinedSource.source() }
          );

          const output = { filename, source: combinedSource };
          this._insertOutput(compiler, compilation, output);
          this._cachedOutput = output;
          addDependencies(compilation, scripts);

          callback();
        })
        .catch((err: Error) => callback(err));
    });
  }
}
