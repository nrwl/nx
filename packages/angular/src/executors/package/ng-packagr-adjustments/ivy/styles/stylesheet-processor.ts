/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Added the filePath parameter to the cache key.
 * - Added PostCSS plugins needed to support TailwindCSS.
 * - Added watch mode parameter.
 */

import * as browserslist from 'browserslist';
import * as cacache from 'cacache';
import { createHash } from 'crypto';
import * as findCacheDirectory from 'find-cache-dir';
import { EsbuildExecutor } from 'ng-packagr/lib/esbuild/esbuild-executor';
import { readFile } from 'ng-packagr/lib/utils/fs';
import * as log from 'ng-packagr/lib/utils/log';
import { tmpdir } from 'os';
import { extname } from 'path';
import postcss from 'postcss';
import * as postcssPresetEnv from 'postcss-preset-env';
import * as postcssUrl from 'postcss-url';
import { getTailwindPostCssPluginsIfPresent } from '../../utilities/tailwindcss';

export enum CssUrl {
  inline = 'inline',
  none = 'none',
}

export interface Result {
  css: string;
  warnings: string[];
  error?: string;
}

const cachePath = findCacheDirectory({ name: 'ng-packagr-styles' }) || tmpdir();
const ngPackagrVersion = require('ng-packagr/package.json').version;

export class StylesheetProcessor {
  private browserslistData: string[];
  private postCssProcessor: ReturnType<typeof postcss>;
  private esbuild = new EsbuildExecutor();

  constructor(
    private readonly basePath: string,
    private readonly cssUrl?: CssUrl,
    private readonly styleIncludePaths?: string[],
    private readonly watch?: boolean
  ) {
    this.browserslistData = browserslist(undefined, { path: this.basePath });
    this.postCssProcessor = this.createPostCssPlugins();
  }

  async process(filePath: string): Promise<string> {
    const content = await readFile(filePath, 'utf8');
    let key: string | undefined;

    if (!content.includes('@import') && !content.includes('@use')) {
      // No transitive deps, we can cache more aggressively.
      key = generateKey(content, this.browserslistData, filePath);
      const result = await readCacheEntry(cachePath, key);
      if (result) {
        result.warnings.forEach((msg) => log.warn(msg));
        return result.css;
      }
    }

    // Render pre-processor language (sass, styl, less)
    const renderedCss = await this.renderCss(filePath, content);

    // We cannot cache CSS re-rendering phase, because a transitive dependency via (@import) can case different CSS output.
    // Example a change in a mixin or SCSS variable.
    if (!key) {
      key = generateKey(renderedCss, this.browserslistData, filePath);
    }

    const cachedResult = await readCacheEntry(cachePath, key);
    if (cachedResult) {
      cachedResult.warnings.forEach((msg) => log.warn(msg));
      return cachedResult.css;
    }

    // Render postcss (autoprefixing and friends)
    const result = await this.postCssProcessor.process(renderedCss, {
      from: filePath,
      to: filePath.replace(extname(filePath), '.css'),
    });

    const warnings = result.warnings().map((w) => w.toString());
    const { code, warnings: esBuildWarnings } = await this.esbuild.transform(
      result.css,
      {
        loader: 'css',
        minify: true,
        sourcefile: filePath,
      }
    );

    if (esBuildWarnings.length > 0) {
      warnings.push(
        ...(await this.esbuild.formatMessages(esBuildWarnings, {
          kind: 'warning',
        }))
      );
    }

    // Add to cache
    await cacache.put(
      cachePath,
      key,
      JSON.stringify({
        css: code,
        warnings,
      })
    );

    warnings.forEach((msg) => log.warn(msg));

    return code;
  }

  private createPostCssPlugins(): ReturnType<typeof postcss> {
    const postCssPlugins = [];
    if (this.cssUrl !== CssUrl.none) {
      postCssPlugins.push(postcssUrl({ url: this.cssUrl }));
    }

    postCssPlugins.push(
      ...getTailwindPostCssPluginsIfPresent(
        this.basePath,
        this.styleIncludePaths,
        this.watch
      )
    );

    postCssPlugins.push(
      postcssPresetEnv({
        browsers: this.browserslistData,
        autoprefixer: true,
        stage: 3,
      })
    );

    return postcss(postCssPlugins);
  }

  private async renderCss(filePath: string, css: string): Promise<string> {
    const ext = extname(filePath);

    switch (ext) {
      case '.sass':
      case '.scss': {
        /*
         * Please be aware of the few differences in behaviour https://github.com/sass/dart-sass/blob/master/README.md#behavioral-differences-from-ruby-sass
         * By default `npm install` will install sass.
         * To use node-sass you need to use:
         *   Npm:
         *     `npm install node-sass --save-dev`
         *   Yarn:
         *     `yarn add node-sass --dev`
         */
        let sassCompiler: any | undefined;
        try {
          sassCompiler = require('node-sass'); // Check if node-sass is explicitly included.
        } catch {
          sassCompiler = await import('sass');
        }

        return sassCompiler
          .renderSync({
            file: filePath,
            data: css,
            indentedSyntax: '.sass' === ext,
            importer: await import('node-sass-tilde-importer'),
            includePaths: this.styleIncludePaths,
          })
          .css.toString();
      }
      case '.less': {
        const { css: content } = await (
          await import('less')
        ).render(css, {
          filename: filePath,
          javascriptEnabled: true,
          paths: this.styleIncludePaths,
        });

        return content;
      }
      case '.styl':
      case '.stylus': {
        const stylus = await import('stylus');

        return (
          stylus(css)
            // add paths for resolve
            .set('paths', [
              this.basePath,
              '.',
              ...this.styleIncludePaths,
              'node_modules',
            ])
            // add support for resolving plugins from node_modules
            .set('filename', filePath)
            // turn on url resolver in stylus, same as flag --resolve-url
            .set('resolve url', true)
            .define('url', stylus.resolver(undefined))
            .render()
        );
      }
      case '.css':
      default:
        return css;
    }
  }
}

function generateKey(
  content: string,
  browserslistData: string[],
  filePath: string
): string {
  return createHash('sha1')
    .update(ngPackagrVersion)
    .update(content)
    .update(browserslistData.join(''))
    .update(filePath)
    .digest('hex');
}

async function readCacheEntry(
  cachePath: string,
  key: string
): Promise<Result | undefined> {
  const entry = await cacache.get.info(cachePath, key);
  if (entry) {
    return JSON.parse(await readFile(entry.path, 'utf8'));
  }

  return undefined;
}
