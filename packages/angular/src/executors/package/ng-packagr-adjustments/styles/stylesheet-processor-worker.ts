/**
 * Adapted from the original ng-packagr source.
 *
 * Changes made:
 * - Added the filePath parameter to the cache key.
 * - Added PostCSS plugins needed to support TailwindCSS.
 * - Added watch mode option.
 */

import * as cacache from 'cacache';
import { createHash } from 'crypto';
import { EsbuildExecutor } from 'ng-packagr/lib/esbuild/esbuild-executor';
import { readFile } from 'ng-packagr/lib/utils/fs';
import * as path from 'path';
import postcss, { LazyResult } from 'postcss';
import * as postcssPresetEnv from 'postcss-preset-env';
import * as postcssUrl from 'postcss-url';
import { parentPort } from 'worker_threads';
import { getTailwindPostCssPluginsIfPresent } from '../utilities/tailwindcss';
import { CssUrl, WorkerOptions, WorkerResult } from './stylesheet-processor';

const ngPackagrVersion = require('ng-packagr/package.json').version;

async function processCss({
  filePath,
  browserslistData,
  cssUrl,
  styleIncludePaths,
  basePath,
  cachePath,
  alwaysUseWasm,
  watch,
}: WorkerOptions): Promise<WorkerResult> {
  const esbuild = new EsbuildExecutor(alwaysUseWasm);
  const content = await readFile(filePath, 'utf8');
  let key: string | undefined;

  if (!content.includes('@import') && !content.includes('@use')) {
    // No transitive deps, we can cache more aggressively.
    key = generateKey(content, browserslistData, filePath);
    const result = await readCacheEntry(cachePath, key);
    if (result) {
      return result;
    }
  }

  // Render pre-processor language (sass, styl, less)
  const renderedCss = await renderCss(
    filePath,
    content,
    basePath,
    styleIncludePaths
  );

  // We cannot cache CSS re-rendering phase, because a transitive dependency via (@import) can case different CSS output.
  // Example a change in a mixin or SCSS variable.
  if (!key) {
    key = generateKey(renderedCss, browserslistData, filePath);

    const cachedResult = await readCacheEntry(cachePath, key);
    if (cachedResult) {
      return cachedResult;
    }
  }

  // Render postcss (autoprefixing and friends)
  const result = await optimizeCss(
    filePath,
    renderedCss,
    browserslistData,
    basePath,
    styleIncludePaths,
    cssUrl,
    watch
  );
  const warnings = result.warnings().map((w) => w.toString());

  const { code, warnings: esBuildWarnings } = await esbuild.transform(
    result.css,
    {
      loader: 'css',
      minify: true,
      sourcefile: filePath,
    }
  );

  if (esBuildWarnings.length > 0) {
    warnings.push(
      ...(await esbuild.formatMessages(esBuildWarnings, { kind: 'warning' }))
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

  return {
    css: code,
    warnings,
  };
}

async function renderCss(
  filePath: string,
  css: string,
  basePath: string,
  styleIncludePaths?: string[]
): Promise<string> {
  const ext = path.extname(filePath);

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
          includePaths: styleIncludePaths,
        })
        .css.toString();
    }
    case '.less': {
      const { css: content } = await (
        await import('less')
      ).render(css, {
        filename: filePath,
        javascriptEnabled: true,
        paths: styleIncludePaths,
      });

      return content;
    }
    case '.styl':
    case '.stylus': {
      const stylus = await import('stylus');

      return (
        stylus(css)
          // add paths for resolve
          .set('paths', [basePath, '.', ...styleIncludePaths, 'node_modules'])
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

function optimizeCss(
  filePath: string,
  css: string,
  browsers: string[],
  basePath: string,
  includePaths?: string[],
  cssUrl?: CssUrl,
  watch?: boolean
): LazyResult {
  const postCssPlugins = [];

  if (cssUrl !== CssUrl.none) {
    postCssPlugins.push(postcssUrl({ url: cssUrl }));
  }

  postCssPlugins.push(
    ...getTailwindPostCssPluginsIfPresent(basePath, includePaths, watch)
  );

  postCssPlugins.push(
    postcssPresetEnv({
      browsers,
      autoprefixer: true,
      stage: 3,
    })
  );

  return postcss(postCssPlugins).process(css, {
    from: filePath,
    to: filePath.replace(path.extname(filePath), '.css'),
  });
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
): Promise<WorkerResult | undefined> {
  const entry = await cacache.get.info(cachePath, key);
  if (entry) {
    return JSON.parse(await readFile(entry.path, 'utf8'));
  }

  return undefined;
}

parentPort.on('message', async ({ signal, port, workerOptions }) => {
  try {
    const result = await processCss(workerOptions);
    port.postMessage({ ...result });
  } catch (error) {
    port.postMessage({ error: error.message });
  } finally {
    // Change the value of signal[0] to 1
    Atomics.add(signal, 0, 1);
    // Unlock the main thread
    Atomics.notify(signal, 0);
    port.close();
  }
});
