import {
  IndexHtmlGenerator,
  type FileInfo,
  type IndexHtmlGeneratorOptions,
} from '@angular/build/private';
import { VERSION } from '@angular/core';
import { isAngularBuildVersionAtLeast } from '@nx/angular-rspack-compiler';
import { Compilation, RspackPluginInstance, type Compiler } from '@rspack/core';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { basename, extname, join } from 'node:path';
import type { I18nOptions, IndexExpandedDefinition } from '../models';
import {
  type CriticalCssPlan,
  loadAngularBuildBeasties,
} from '../utils/beasties';
import { addEventDispatchContract } from '../utils/index-file/add-event-dispatch-contract';
import { addNgcmAttribute } from '../utils/index-file/ngcm-attribute';
import { addNonce, findNonce } from '../utils/index-file/nonce';
import { assertIsError } from '../utils/misc-helpers';
import { ensureOutputPaths } from '../utils/i18n';
import { addError, addWarning } from '../utils/rspack-diagnostics';
import {
  addTrailingSlash,
  joinUrlParts,
  stripLeadingSlash,
} from '../utils/url';
import { getIndexOutputFile } from '../utils/index-file/get-index-output-file';

/** The index html documents of a server build for one locale. */
export interface ServerIndexHtml {
  /** `index.server.html`, the document server rendering renders into. */
  server: string;
  /** `index.csr.html`, served as-is for client-rendered routes. */
  csr: string;
  /** The `ngCspNonce` attribute value of the server document. */
  nonce: string | undefined;
}

export interface ServerRenderingInputs {
  /** Keyed by locale, the empty string when not localizing. */
  indexHtml: Map<string, ServerIndexHtml>;
  /**
   * Set when critical CSS is inlined from compiled plans, which
   * `@angular/build` >= 22.2 does.
   */
  criticalCssPlans: CriticalCssPlan[] | undefined;
}

/**
 * Holds the server rendering inputs of the browser compiler's last
 * compilation without errors, for the server compiler that runs after it.
 */
export interface SharedServerRenderingInputs {
  current?: ServerRenderingInputs;
}

export interface IndexHtmlPluginOptions extends IndexHtmlGeneratorOptions {
  baseHref: string | undefined;
  i18n: I18nOptions;
  index: IndexExpandedDefinition;
  isSsr: boolean;
  outputPath: string;
  serverRenderingInputs?: SharedServerRenderingInputs;
}

const PLUGIN_NAME = 'IndexHtmlPlugin';

/**
 * Whether a server build emits its server index as `index.original.html`,
 * which Nx's CommonEngine server template renders instead of `index.html`.
 * From 22.2, CommonEngine inlining critical CSS a second time into the browser
 * index leaves a stylesheet that never loads.
 */
export function emitsServerIndexAsOriginal(
  index: IndexExpandedDefinition
): boolean {
  return (
    isAngularBuildVersionAtLeast('22.2.0') &&
    getIndexOutputFile(index) === 'index.html'
  );
}

/**
 * Holds the server index documents between generation and hashing, which
 * rewrites their file references. Removed from the browser output after.
 */
const SERVER_INDEX_ASSETS_DIR = '__ng-rspack-server-index__';

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

  /** The output of the generator steps shared by all index documents. */
  #sharedIndexContent: string | undefined;
  #pendingServerRenderingInputs: ServerRenderingInputs | undefined;

  constructor(override readonly options: IndexHtmlPluginOptions) {
    super(
      options.serverRenderingInputs
        ? {
            ...options,
            // The last generator step shared by all index documents, where
            // the server documents branch off.
            postTransform: async (html) => {
              this.#sharedIndexContent = options.postTransform
                ? await options.postTransform(html)
                : html;
              return this.#sharedIndexContent;
            },
          }
        : options
    );
  }

  apply(compiler: Compiler) {
    const { serverRenderingInputs } = this.options;
    const emitServerIndexAsOriginal = emitsServerIndexAsOriginal(
      this.options.index
    );
    const compileCriticalCssPlans =
      isAngularBuildVersionAtLeast('22.2.0') &&
      !!this.options.optimization?.styles.inlineCritical;

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      this._compilation = compilation;
      const serverIndexAssets: {
        locale: string;
        outputPath: string;
        server: string;
        csr: string;
      }[] = [];

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

            // v22+ emits an importmap with per-lazy-chunk SRI. Fill the map the
            // augment plugin captured at construction (allocated in ng-rspack on
            // SRI builds). Eager chunks already carry an integrity attribute on
            // their <script> tag; a chunk is initial when any of its groups is
            // (entrypoint.getFiles() is deep and would wrongly include lazy files).
            const chunksIntegrity = this.options.chunksIntegrity as
              | Map<string, string>
              | undefined;
            if (chunksIntegrity && +VERSION.major >= 22) {
              chunksIntegrity.clear();

              const initialFiles = new Set<string>();
              for (const chunk of compilation.chunks) {
                let isInitial = false;
                for (const group of chunk.groupsIterable) {
                  if (group.isInitial()) {
                    isInitial = true;
                    break;
                  }
                }
                if (isInitial) {
                  for (const file of chunk.files) {
                    initialFiles.add(file);
                  }
                }
              }

              for (const { file, extension } of files) {
                if (extension !== '.js' || initialFiles.has(file)) {
                  continue;
                }

                const hash = createHash('sha384')
                  .update(compilation.assets[file].buffer())
                  .digest('base64');
                chunksIntegrity.set(file, `sha384-${hash}`);
              }
            }

            const outputPaths = ensureOutputPaths(
              this.options.outputPath,
              this.options.i18n
            );

            for (const [locale, outputPath] of outputPaths.entries()) {
              // @angular/build 22.2 reads `outputPath` from the constructor
              // options; earlier versions read it from these.
              const processOptions = {
                files,
                outputPath,
                baseHref:
                  this.getLocaleBaseHref(locale) ?? this.options.baseHref,
                lang: locale || undefined,
              };
              const { csrContent, warnings, errors } =
                await this.process(processOptions);

              let html = csrContent;
              if (this.options.isSsr) {
                html = await addEventDispatchContract(csrContent);
              }

              const { RawSource } = compiler.rspack.sources;
              compilation.emitAsset(
                join(outputPath, getIndexOutputFile(this.options.index)),
                new RawSource(html)
              );

              if (serverRenderingInputs) {
                assert(
                  this.#sharedIndexContent !== undefined,
                  'The index html generator did not run its shared steps.'
                );
                // Unlike the browser index, these match the documents the
                // `@angular/build` application builder generates for a server.
                const [server, csr] = await Promise.all([
                  addEventDispatchContract(this.#sharedIndexContent).then(
                    addNonce
                  ),
                  addNgcmAttribute(csrContent),
                ]);
                const assetsDir = `${SERVER_INDEX_ASSETS_DIR}/${serverIndexAssets.length}`;
                const serverIndexAsset = {
                  locale,
                  outputPath,
                  server: `${assetsDir}/index.server.html`,
                  csr: `${assetsDir}/index.csr.html`,
                };
                compilation.emitAsset(
                  serverIndexAsset.server,
                  new RawSource(server)
                );
                compilation.emitAsset(serverIndexAsset.csr, new RawSource(csr));
                serverIndexAssets.push(serverIndexAsset);
              }

              warnings.forEach((msg) => addWarning(compilation, msg));
              errors.forEach((msg) => addError(compilation, msg));
            }
          } catch (error) {
            assertIsError(error);
            addError(compilation, error.message);
          }
        }
      );

      if (!serverRenderingInputs) {
        return;
      }

      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          // Hashing renames the files the documents and plans reference.
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH + 1,
        },
        async () => {
          try {
            const indexHtml = new Map<string, ServerIndexHtml>();
            for (const {
              locale,
              outputPath,
              server,
              csr,
            } of serverIndexAssets) {
              const serverContent = compilation.assets[server]
                .source()
                .toString();
              const csrContent = compilation.assets[csr].source().toString();
              compilation.deleteAsset(server);
              compilation.deleteAsset(csr);
              indexHtml.set(locale, {
                server: serverContent,
                csr: csrContent,
                nonce: (await findNonce(serverContent)) ?? undefined,
              });
              if (emitServerIndexAsOriginal) {
                compilation.emitAsset(
                  join(outputPath, 'index.original.html'),
                  new compiler.rspack.sources.RawSource(serverContent)
                );
              }
            }

            this.#pendingServerRenderingInputs = {
              indexHtml,
              criticalCssPlans: compileCriticalCssPlans
                ? await this.#compileCriticalCssPlans(compilation)
                : undefined,
            };
          } catch (error) {
            assertIsError(error);
            addError(compilation, error.message);
          }
        }
      );
    });

    if (serverRenderingInputs) {
      compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {
        // A compilation with errors emits nothing, so the server compiler
        // keeps the documents matching the browser output on disk.
        if (!stats.hasErrors() && this.#pendingServerRenderingInputs) {
          serverRenderingInputs.current = this.#pendingServerRenderingInputs;
        }
        this.#pendingServerRenderingInputs = undefined;
      });
    }
  }

  /** Compiles every stylesheet the way `@angular/build` >= 22.2 does. */
  async #compileCriticalCssPlans(
    compilation: Compilation
  ): Promise<CriticalCssPlan[]> {
    const { compileSheet, encodePlan } =
      await loadAngularBuildBeasties('compiler');
    const stylesheets = new Set<string>();
    for (const chunk of compilation.chunks) {
      for (const file of chunk.files) {
        if (extname(file) === '.css') {
          stylesheets.add(file);
        }
      }
    }

    const plans: CriticalCssPlan[] = [];
    for (const file of stylesheets) {
      const sheet = compileSheet(compilation.assets[file].source().toString(), {
        href: joinUrlParts(this.options.deployUrl ?? '', file),
      });
      plans.push(encodePlan(sheet));
    }
    return plans;
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

    let joinedBaseHref: string | undefined;
    if (baseHrefSuffix !== '') {
      joinedBaseHref = addTrailingSlash(
        joinUrlParts(this.options.baseHref || '', baseHrefSuffix)
      );

      if (this.options.baseHref && this.options.baseHref[0] !== '/') {
        joinedBaseHref = stripLeadingSlash(joinedBaseHref);
      }
    }

    return joinedBaseHref;
  }
}
