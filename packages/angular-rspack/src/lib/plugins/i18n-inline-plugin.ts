import { RspackPluginInstance, Compiler, sources } from '@rspack/core';
import {
  PluginObj,
  parseSync,
  transformFromAstAsync,
  types,
} from '@babel/core';
import remapping from '@ampproject/remapping';
import assert from 'node:assert';
import { I18nOptions, NormalizedAngularRspackPluginOptions } from '../models';

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

  constructor(
    pluginOptions: NormalizedAngularRspackPluginOptions,
    i18nOptions: I18nOptions
  ) {
    this.#pluginOptions = pluginOptions;
    this.#i18n = i18nOptions;
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
          if (localeFileName.endsWith('index.html')) {
            // update the baseHref for the locale and set the lang attribute
            const html = typeof text === 'string' ? text : text.toString();
            const updatedHtml = await this.#updateBaseHrefAndLang(
              html,
              localeSubPath
            );
            compilation.emitAsset(
              localeFileName,
              new sources.RawSource(updatedHtml)
            );
            if (compilation.getAsset(filename)) {
              compilation.deleteAsset(filename);
            }
            continue;
          }
          if (map) {
            compilation.emitAsset(
              localeFileName,
              new sources.SourceMapSource(text, localeFileName, map)
            );
          }
          compilation.emitAsset(localeFileName, new sources.RawSource(text));
          if (compilation.getAsset(filename)) {
            compilation.deleteAsset(filename);
          }
        }
      }

      callback();
    });
  }

  async #updateBaseHrefAndLang(html: string, localeSubPath: string) {
    // TODO: add support for diagnostics
    const dir = localeSubPath
      ? await this.#getLanguageDirection(localeSubPath, [])
      : undefined;
    html = html.replace(
      /<base href="([^"]+)">/g,
      `<base href="/${localeSubPath}$1">`
    );
    html = html.replace(
      /<html lang="([^"]+)">/g,
      `<html lang="${localeSubPath}"${dir ? ` dir="${dir}"` : ''}>`
    );
    return html;
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
    this.#localizeToolsModule ??=
      await this.#loadEsmModule<LocalizeUtilityModule>(
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

  #loadEsmModule<T>(modulePath: string | URL): Promise<T> {
    const load = new Function(
      'modulePath',
      `return import(modulePath);`
    ) as Exclude<typeof load, undefined>;

    return load(modulePath);
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
   * @param options The inline request options to use.
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

  async #getLanguageDirection(
    locale: string,
    warnings: string[]
  ): Promise<string | undefined> {
    const dir = await this.#getLanguageDirectionFromLocales(locale);

    if (!dir) {
      warnings.push(
        `Locale data for '${locale}' cannot be found. 'dir' attribute will not be set for this locale.`
      );
    }

    return dir;
  }

  async #getLanguageDirectionFromLocales(
    locale: string
  ): Promise<string | undefined> {
    try {
      const localeData = (
        await this.#loadEsmModule<typeof import('@angular/common/locales/en')>(
          `@angular/common/locales/${locale}`
        )
      ).default;

      const dir = localeData[localeData.length - 2];

      return this.#isString(dir) ? dir : undefined;
    } catch {
      // In some cases certain locales might map to files which are named only with language id.
      // Example: `en-US` -> `en`.
      const [languageId] = locale.split('-', 1);
      if (languageId !== locale) {
        return this.#getLanguageDirectionFromLocales(languageId);
      }
    }

    return undefined;
  }

  #isString(value: unknown): value is string {
    return typeof value === 'string';
  }
}
