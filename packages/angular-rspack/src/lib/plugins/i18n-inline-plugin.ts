import remapping from '@ampproject/remapping';
import {
  type PluginObj,
  parseSync,
  transformFromAstAsync,
  types,
} from '@babel/core';
import {
  type Compiler,
  type RspackPluginInstance,
  sources,
} from '@rspack/core';
import assert from 'node:assert';
import type {
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
} from '../models';
import { getLocaleOutputPaths } from '../utils/i18n';
import { loadEsmModule } from '../utils/misc-helpers';

/**
 * A Type representing the localize tools module.
 */
type LocalizeUtilityModule = typeof import('@angular/localize/tools');

const PLUGIN_NAME = 'I18nInlinePlugin';

export class I18nInlinePlugin implements RspackPluginInstance {
  #pluginOptions: NormalizedAngularRspackPluginOptions;
  #i18n: I18nOptions;
  /**
   * Cached instance of the `@angular/localize/tools` module.
   * This is used to remove the need to repeatedly import the module per file translation.
   */
  #localizeToolsModule: LocalizeUtilityModule | undefined;
  #outputPaths: Set<string>;

  constructor(
    pluginOptions: NormalizedAngularRspackPluginOptions,
    i18nOptions: I18nOptions
  ) {
    this.#pluginOptions = pluginOptions;
    this.#i18n = i18nOptions;
    this.#outputPaths = new Set(getLocaleOutputPaths(i18nOptions).values());
  }

  apply(compiler: Compiler) {
    compiler.hooks.emit.tapAsync(PLUGIN_NAME, async (compilation, callback) => {
      const filesToInline = new Map<
        string,
        { text: string; map: sources.RawSourceMap | null }
      >();
      const additionalFiles = new Map<string, sources.Source>();
      for (const [filename, source] of Object.entries(compilation.assets)) {
        let contents = source.source();
        if (typeof contents !== 'string') {
          contents = contents.toString();
        }
        if (!filename.endsWith('.map') && contents.includes('$localize')) {
          filesToInline.set(filename, { text: contents, map: source.map() });
        } else {
          additionalFiles.set(filename, source);
        }
      }

      // Map of locales to Map of files to output
      const filesToOutput = new Map<
        string,
        Map<string, { text: string | Buffer; map: sources.RawSourceMap | null }>
      >();
      for (const localeKey of this.#i18n.inlineLocales) {
        const locale = this.#i18n.locales[localeKey];
        const localeFiles = new Map<
          string,
          { text: string | Buffer; map: sources.RawSourceMap | null }
        >();
        for (const [filename, { text, map }] of filesToInline.entries()) {
          if (this.#checkAssetHasBeenProcessed(filename)) {
            continue;
          }
          const result = await this.#transformWithBabel(
            text,
            map,
            filename,
            localeKey,
            locale.translation,
            this.#pluginOptions.advancedOptimizations
          );
          localeFiles.set(filename, { text: result.code, map: result.map });
          // TODO: Add support for diagnostics
        }
        for (const [filename, source] of additionalFiles.entries()) {
          if (this.#checkAssetHasBeenProcessed(filename)) {
            continue;
          }
          localeFiles.set(filename, {
            text: source.source(),
            map: source.map(),
          });
        }
        filesToOutput.set(locale.subPath, localeFiles);
      }

      for (const [localeSubPath, files] of filesToOutput.entries()) {
        for (const [filename, { text, map }] of files.entries()) {
          const localeFileName = `${localeSubPath}/${filename}`;
          const asset = compilation.getAsset(filename);
          const assetInfo = asset?.info;

          if (map) {
            compilation.emitAsset(
              localeFileName,
              new sources.SourceMapSource(text, localeFileName, map),
              (newAssetInfo) => ({ ...assetInfo, ...newAssetInfo })
            );
          }
          compilation.emitAsset(
            localeFileName,
            new sources.RawSource(text),
            (newAssetInfo) => ({ ...assetInfo, ...newAssetInfo })
          );
          if (asset) {
            compilation.deleteAsset(filename);
          }
        }
      }

      callback();
    });
  }

  #checkAssetHasBeenProcessed(filename: string) {
    return this.#outputPaths.has(filename.split('/')[0]);
  }

  /**
   * Attempts to load the `@angular/localize/tools` module containing the functionality to
   * perform the file translations.
   * This module must be dynamically loaded as it is an ESM module and this file is CommonJS.
   */
  async #loadLocalizeTools() {
    // Load ESM `@angular/localize/tools` using the TypeScript dynamic import workaround.
    // Once TypeScript provides support for keeping the dynamic import this workaround can be
    // changed to a direct dynamic import.
    this.#localizeToolsModule ??= await loadEsmModule<LocalizeUtilityModule>(
      '@angular/localize/tools'
    );
  }

  /**
   * Creates the needed Babel plugins to inline a given locale and translation for a JavaScript file.
   * @param locale A string containing the locale specifier to use.
   * @param translation A object record containing locale specific messages to use.
   * @returns An array of Babel plugins.
   */
  async #createI18nPlugins(
    locale: string,
    translation: Record<string, unknown> | undefined
  ) {
    await this.#loadLocalizeTools();
    const { Diagnostics, makeEs2015TranslatePlugin } =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.#localizeToolsModule!;

    const plugins: PluginObj[] = [];
    const diagnostics = new Diagnostics();

    plugins.push(
      makeEs2015TranslatePlugin(diagnostics, (translation || {}) as any, {
        missingTranslation:
          translation === undefined
            ? 'ignore'
            : this.#pluginOptions.i18nMissingTranslation,
      })
    );

    // Create a plugin to replace the locale specifier constant inject by the build system with the actual specifier
    plugins.push({
      visitor: {
        StringLiteral(path) {
          if (path.node.value === '___NG_LOCALE_INSERT___') {
            path.replaceWith(types.stringLiteral(locale));
          }
        },
      },
    });

    return { diagnostics, plugins };
  }

  #assertIsError(value: unknown): asserts value is Error & { code?: string } {
    const isError =
      value instanceof Error ||
      // The following is needing to identify errors coming from RxJs.
      (typeof value === 'object' &&
        value &&
        'name' in value &&
        'message' in value);
    assert(isError, 'catch clause variable is not an Error instance');
  }

  /**
   * Transforms a JavaScript file using Babel to inline the request locale and translation.
   * @param code A string containing the JavaScript code to transform.
   * @param map A sourcemap object for the provided JavaScript code.
   * @param filename The filename of the JavaScript file to transform.
   * @param locale The locale to inline.
   * @param translation The translation to inline.
   * @param shouldOptimize Whether to optimize the transformed code.
   * @returns An object containing the code, map, and diagnostics from the transformation.
   */
  async #transformWithBabel(
    code: string,
    map: sources.RawSourceMap | null,
    filename: string,
    locale: string,
    translation: Record<string, unknown> | undefined,
    shouldOptimize: boolean
  ) {
    let ast;
    try {
      ast = parseSync(code, {
        babelrc: false,
        configFile: false,
        sourceType: 'unambiguous',
        filename,
      });
    } catch (error) {
      this.#assertIsError(error);

      // Make the error more readable.
      // Same errors will contain the full content of the file as the error message
      // Which makes it hard to find the actual error message.
      const index = error.message.indexOf(')\n');
      const msg =
        index !== -1 ? error.message.slice(0, index + 1) : error.message;
      throw new Error(`${msg}\nAn error occurred inlining file "${filename}"`);
    }

    if (!ast) {
      throw new Error(`Unknown error occurred inlining file "${filename}"`);
    }

    const { diagnostics, plugins } = await this.#createI18nPlugins(
      locale,
      translation
    );
    const transformResult = await transformFromAstAsync(ast, code, {
      filename,
      // false is a valid value but not included in the type definition
      inputSourceMap: false as unknown as undefined,
      sourceMaps: !!map,
      compact: shouldOptimize,
      configFile: false,
      babelrc: false,
      browserslistConfigFile: false,
      plugins,
    });

    if (!transformResult || !transformResult.code) {
      throw new Error(
        `Unknown error occurred processing bundle for "${filename}".`
      );
    }

    let outputMap;
    if (map && transformResult.map) {
      outputMap = remapping([transformResult.map, map], () => null);
    }

    return {
      code: transformResult.code,
      map: outputMap && JSON.stringify(outputMap),
      diagnostics,
    };
  }
}
