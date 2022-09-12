import * as webpack from 'webpack';
import { basename, dirname, extname } from 'path';
import { FileInfo } from './index-file/augment-index-html';
import {
  IndexHtmlGenerator,
  IndexHtmlGeneratorOptions,
  IndexHtmlGeneratorProcessOptions,
} from './index-file/index-html-generator';

export interface IndexHtmlWebpackPluginOptions
  extends IndexHtmlGeneratorOptions,
    Omit<
      IndexHtmlGeneratorProcessOptions,
      'files' | 'noModuleFiles' | 'moduleFiles'
    > {
  noModuleEntrypoints: string[];
  moduleEntrypoints: string[];
}

type Compiler = any;

const PLUGIN_NAME = 'index-html-webpack-plugin';

export class IndexHtmlWebpackPlugin extends IndexHtmlGenerator {
  private _compilation: any | undefined;

  get compilation(): any {
    if (this._compilation) {
      return this._compilation;
    }

    throw new Error('compilation is undefined.');
  }

  constructor(readonly options: IndexHtmlWebpackPluginOptions) {
    super(options);
  }

  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      this._compilation = compilation;
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE + 1,
        },
        callback
      );
    });

    function addWarning(compilation: any, message: string): void {
      compilation.warnings.push(new this.webpack.WebpackError(message));
    }

    function addError(compilation: any, message: string): void {
      compilation.errors.push(new this.webpack.WebpackError(message));
    }

    const callback = async (assets: Record<string, unknown>) => {
      // Get all files for selected entrypoints
      const files: FileInfo[] = [];
      const noModuleFiles: FileInfo[] = [];
      const moduleFiles: FileInfo[] = [];

      try {
        for (const [entryName, entrypoint] of this.compilation.entrypoints) {
          const entryFiles: FileInfo[] = entrypoint
            ?.getFiles()
            ?.filter((f) => !f.endsWith('.hot-update.js'))
            ?.map(
              (f: string): FileInfo => ({
                name: entryName,
                file: f,
                extension: extname(f),
              })
            );

          if (!entryFiles) {
            continue;
          }

          if (this.options.noModuleEntrypoints.includes(entryName)) {
            noModuleFiles.push(...entryFiles);
          } else if (this.options.moduleEntrypoints.includes(entryName)) {
            moduleFiles.push(...entryFiles);
          } else {
            files.push(...entryFiles);
          }
        }

        const { content, warnings, errors } = await this.process({
          files,
          noModuleFiles,
          moduleFiles,
          outputPath: dirname(this.options.outputPath),
          baseHref: this.options.baseHref,
          lang: this.options.lang,
        });

        assets[this.options.outputPath] = new webpack.sources.RawSource(
          content
        );

        warnings.forEach((msg) => addWarning(this.compilation, msg));
        errors.forEach((msg) => addError(this.compilation, msg));
      } catch (error) {
        addError(this.compilation, error.message);
      }
    };
  }

  async readAsset(path: string): Promise<string> {
    const data = this.compilation.assets[basename(path)].source();

    return typeof data === 'string' ? data : data.toString();
  }

  protected async readIndex(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.compilation.inputFileSystem.readFile(
        path,
        (err?: Error, data?: string | Buffer) => {
          if (err) {
            reject(err);

            return;
          }

          this.compilation.fileDependencies.add(path);
          resolve(data?.toString() ?? '');
        }
      );
    });
  }
}
