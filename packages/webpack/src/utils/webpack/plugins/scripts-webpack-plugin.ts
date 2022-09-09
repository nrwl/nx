import { interpolateName } from 'loader-utils';
import * as path from 'path';
import { Compiler } from 'webpack';
import {
  CachedSource,
  ConcatSource,
  OriginalSource,
  RawSource,
  Source,
} from 'webpack-sources';

const Chunk = require('webpack/lib/Chunk');
const EntryPoint = require('webpack/lib/Entrypoint');

export interface ScriptsWebpackPluginOptions {
  name: string;
  sourceMap: boolean;
  scripts: string[];
  filename: string;
  basePath: string;
}

interface ScriptOutput {
  filename: string;
  source: Source;
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
    'scripts-webpack-plugin',
    (compilation: any) => {
      compilation.hooks.additionalAssets.tapAsync(
        'scripts-webpack-plugin',
        (callback: (err?: Error) => void) => action(compilation, callback)
      );
    }
  );
}

export class ScriptsWebpackPlugin {
  private _lastBuildTime?: number;
  private _cachedOutput?: ScriptOutput;

  constructor(private options: Partial<ScriptsWebpackPluginOptions> = {}) {}

  shouldSkip(compilation: any, scripts: string[]): boolean {
    if (this._lastBuildTime == undefined) {
      this._lastBuildTime = Date.now();
      return false;
    }

    for (let i = 0; i < scripts.length; i++) {
      const scriptTime = compilation.fileTimestamps?.get(scripts[i]);
      if (!scriptTime || scriptTime > this._lastBuildTime) {
        this._lastBuildTime = Date.now();
        return false;
      }
    }

    return true;
  }

  private _insertOutput(
    compilation: any,
    { filename, source }: ScriptOutput,
    cached = false
  ) {
    const chunk = new Chunk(this.options.name);
    chunk.rendered = !cached;
    chunk.id = this.options.name;
    chunk.ids = [chunk.id];

    if (chunk.files instanceof Set) {
      chunk.files.add(filename);
    } else if (chunk.files instanceof Array) {
      chunk.files.push(filename);
    }

    const entrypoint = new EntryPoint(this.options.name);
    entrypoint.pushChunk(chunk);
    chunk.addGroup(entrypoint);
    compilation.entrypoints.set(this.options.name, entrypoint);

    if (compilation.chunks instanceof Set) {
      compilation.chunks.add(chunk);
    } else if (compilation.chunks instanceof Array) {
      compilation.chunks.push(chunk);
    }

    compilation.assets[filename] = source;
  }

  apply(compiler: Compiler): void {
    if (!this.options.scripts || this.options.scripts.length === 0) {
      return;
    }

    const scripts = this.options.scripts
      .filter((script) => !!script)
      .map((script) => path.resolve(this.options.basePath || '', script));

    hook(compiler, (compilation, callback) => {
      if (this.shouldSkip(compilation, scripts)) {
        if (this._cachedOutput) {
          this._insertOutput(compilation, this._cachedOutput, true);
        }

        addDependencies(compilation, scripts);
        callback();

        return;
      }

      const sourceGetters = scripts.map((fullPath) => {
        return new Promise<Source>((resolve, reject) => {
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
                source = new OriginalSource(content, adjustedPath);
              } else {
                source = new RawSource(content);
              }

              resolve(source);
            }
          );
        });
      });

      Promise.all(sourceGetters)
        .then((sources) => {
          const concatSource = new ConcatSource();
          sources.forEach((source) => {
            concatSource.add(source);
            concatSource.add('\n;');
          });

          const combinedSource = new CachedSource(concatSource);
          const filename = interpolateName(
            { resourcePath: 'scripts.js' },
            this.options.filename as string,
            { content: combinedSource.source() }
          );

          const output = { filename, source: combinedSource };
          this._insertOutput(compilation, output);
          this._cachedOutput = output;
          addDependencies(compilation, scripts);

          callback();
        })
        .catch((err: Error) => callback(err));
    });
  }
}
