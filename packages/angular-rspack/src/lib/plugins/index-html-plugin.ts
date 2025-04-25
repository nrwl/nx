import {
  IndexHtmlGenerator,
  type FileInfo,
  type IndexHtmlGeneratorOptions,
} from '@angular/build/private';
import { Compilation, RspackPluginInstance, type Compiler } from '@rspack/core';
import { basename, extname, join } from 'node:path';
import type { I18nOptions, IndexExpandedDefinition } from '../models';
import { addEventDispatchContract } from '../utils/index-file/add-event-dispatch-contract';
import { assertIsError } from '../utils/misc-helpers';
import { ensureOutputPaths } from '../utils/i18n';
import { addError, addWarning } from '../utils/rspack-diagnostics';
import { urlJoin } from '../utils/url-join';

export interface IndexHtmlPluginOptions extends IndexHtmlGeneratorOptions {
  baseHref: string | undefined;
  i18n: I18nOptions;
  index: IndexExpandedDefinition;
  isSsr: boolean;
  outputPath: string;
}

const PLUGIN_NAME = 'IndexHtmlPlugin';

export class IndexHtmlPlugin
  extends IndexHtmlGenerator
  implements RspackPluginInstance
{
  private _compilation: Compilation | undefined;
  get compilation(): Compilation {
    if (this._compilation) {
      return this._compilation;
    }

    throw new Error('compilation is undefined.');
  }

  constructor(override readonly options: IndexHtmlPluginOptions) {
    super(options);
  }

  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      this._compilation = compilation;

      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        async () => {
          const files: FileInfo[] = [];

          try {
            for (const chunk of compilation.chunks) {
              for (const file of chunk.files) {
                // https://github.com/web-infra-dev/rspack/blob/a2e1e21c7e1ed0f34e476ec270e3c5460c4a1a36/packages/rspack/src/config/defaults.ts#L606
                if (
                  file.endsWith('.hot-update.js') ||
                  file.endsWith('.hot-update.mjs')
                ) {
                  continue;
                }

                files.push({
                  name: chunk.name,
                  file,
                  extension: extname(file),
                });
              }
            }

            const outputPaths = ensureOutputPaths(
              this.options.outputPath,
              this.options.i18n
            );

            for (const [locale, outputPath] of outputPaths.entries()) {
              const { csrContent, warnings, errors } = await this.process({
                files,
                outputPath,
                baseHref:
                  this.getLocaleBaseHref(locale) ?? this.options.baseHref,
                lang: locale || undefined,
              });

              let html = csrContent;
              if (this.options.isSsr) {
                html = await addEventDispatchContract(csrContent);
              }

              const { RawSource } = compiler.rspack.sources;
              compilation.emitAsset(
                join(outputPath, getIndexOutputFile(this.options.index)),
                new RawSource(html)
              );

              warnings.forEach((msg) => addWarning(compilation, msg));
              errors.forEach((msg) => addError(compilation, msg));
            }
          } catch (error) {
            assertIsError(error);
            addError(compilation, error.message);
          }
        }
      );
    });
  }

  override async readAsset(path: string): Promise<string> {
    const data = this.compilation.assets[basename(path)].source();

    return typeof data === 'string' ? data : data.toString();
  }

  protected override async readIndex(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.compilation.inputFileSystem) {
        super.readIndex(path).then(resolve).catch(reject);
        return;
      }

      this.compilation.inputFileSystem.readFile(
        path,
        (err?: Error | null, data?: string | Buffer) => {
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

  getLocaleBaseHref(locale: string): string | undefined {
    if (this.options.i18n.flatOutput) {
      return undefined;
    }

    const localeData = this.options.i18n.locales[locale];
    if (!localeData) {
      return undefined;
    }

    const baseHrefSuffix = localeData.baseHref ?? localeData.subPath + '/';

    return baseHrefSuffix !== ''
      ? urlJoin(this.options.baseHref || '', baseHrefSuffix)
      : undefined;
  }
}

function getIndexOutputFile(index: IndexExpandedDefinition): string {
  if (typeof index === 'string') {
    return basename(index);
  }

  return index.output || 'index.html';
}
