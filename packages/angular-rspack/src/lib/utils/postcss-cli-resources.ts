/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { interpolateName } from 'loader-utils';
import * as path from 'node:path';
import * as url from 'node:url';
import type { Declaration, Plugin } from 'postcss';
import { assertIsError } from './misc-helpers';

function wrapUrl(url: string): string {
  let wrappedUrl;
  const hasSingleQuotes = url.indexOf("'") >= 0;

  if (hasSingleQuotes) {
    wrappedUrl = `"${url}"`;
  } else {
    wrappedUrl = `'${url}'`;
  }

  return `url(${wrappedUrl})`;
}

export interface PostcssCliResourcesOptions {
  baseHref?: string;
  deployUrl?: string;
  resourcesOutputPath?: string;
  rebaseRootRelative?: boolean;

  /** CSS is extracted to a `.css` or is embedded in a `.js` file. */
  extracted?: boolean;
  filename: (resourcePath: string) => string;
  loader: import('@rspack/core').LoaderContext<unknown>;
  emitFile: boolean;
}

async function resolve(
  file: string,
  base: string,
  resolver: (file: string, base: string) => Promise<string>
): Promise<string> {
  try {
    return await resolver('./' + file, base);
  } catch {
    return resolver(file, base);
  }
}

export const postcss = true;

export default function (options?: PostcssCliResourcesOptions): Plugin {
  if (!options) {
    throw new Error('No options were specified to "postcss-cli-resources".');
  }

  const {
    deployUrl = '',
    resourcesOutputPath = '',
    filename,
    loader,
    emitFile,
    extracted,
  } = options;

  const process = async (
    inputUrl: string,
    context: string,
    resourceCache: Map<string, string>
  ) => {
    // If root-relative, absolute or protocol relative url, leave as is
    if (/^((?:\w+:)?\/\/|data:|chrome:|#)/.test(inputUrl)) {
      return inputUrl;
    }

    if (/^\//.test(inputUrl)) {
      return inputUrl;
    }

    // If starts with a caret, remove and return remainder
    // this supports bypassing asset processing
    if (inputUrl.startsWith('^')) {
      return inputUrl.slice(1);
    }

    const cacheKey = path.resolve(context, inputUrl);
    const cachedUrl = resourceCache.get(cacheKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    if (inputUrl.startsWith('~')) {
      inputUrl = inputUrl.slice(1);
    }

    const normalizedUrl = inputUrl.replace(/\\/g, '/');
    const parsedUrl = new URL(normalizedUrl, 'file:///');
    const { pathname, hash, search } = parsedUrl;
    const resolver = (file: string, base: string) =>
      new Promise<string>((resolve, reject) => {
        loader.resolve(base, decodeURI(file), (err, result) => {
          if (err) {
            reject(err);

            return;
          }
          resolve(result as string);
        });
      });

    const result = await resolve(pathname as string, context, resolver);

    return new Promise<string>((resolve, reject) => {
      loader.fs.readFile(result, (err, content) => {
        if (err) {
          reject(err);

          return;
        }

        let outputPath = interpolateName(
          // TODO: Revisit. Previously due to lack of type safety, this object
          // was fine, but in practice it doesn't match the type of the loader context.
          { resourcePath: result } as Parameters<typeof interpolateName>[0],
          filename(result),
          {
            content,
            context: loader.context || loader.rootContext,
          }
        ).replace(/\\|\//g, '-');

        if (resourcesOutputPath) {
          outputPath = path.posix.join(resourcesOutputPath, outputPath);
        }

        loader.addDependency(result);
        if (emitFile) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          loader.emitFile(outputPath, content!, undefined, {
            sourceFilename: result,
          });
        }

        let outputUrl = outputPath.replace(/\\/g, '/');
        if (hash || search) {
          outputUrl = outputUrl + (search || '') + (hash || '');
        }

        if (deployUrl && !extracted) {
          outputUrl = new URL(outputUrl, deployUrl).href;
        }

        resourceCache.set(cacheKey, outputUrl);
        resolve(outputUrl);
      });
    });
  };

  const resourceCache = new Map<string, string>();
  const processed = Symbol('postcss-cli-resources');

  return {
    postcssPlugin: 'postcss-cli-resources',
    async Declaration(decl) {
      if (!decl.value.includes('url') || processed in decl) {
        return;
      }

      const value = decl.value;
      const urlRegex = /url(?:\(\s*(['"]?))(.*?)(?:\1\s*\))/g;
      const segments: string[] = [];

      let match;
      let lastIndex = 0;
      let modified = false;

      // We want to load it relative to the file that imports
      const inputFile = decl.source && decl.source.input.file;
      const context = (inputFile && path.dirname(inputFile)) || loader.context;

      while ((match = urlRegex.exec(value))) {
        const originalUrl = match[2];
        let processedUrl;
        try {
          processedUrl = await process(
            originalUrl,
            context ?? '',
            resourceCache
          );
        } catch (err) {
          assertIsError(err);
          loader.emitError(decl.error(err.message, { word: originalUrl }));
          continue;
        }

        if (lastIndex < match.index) {
          segments.push(value.slice(lastIndex, match.index));
        }

        if (!processedUrl || originalUrl === processedUrl) {
          segments.push(match[0]);
        } else {
          segments.push(wrapUrl(processedUrl));
          modified = true;
        }

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < value.length) {
        segments.push(value.slice(lastIndex));
      }

      if (modified) {
        decl.value = segments.join('');
      }

      (decl as Declaration & { [processed]: boolean })[processed] = true;
    },
  };
}
