/**
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) 2022 Brandon Roberts
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as ts from 'typescript';
import { type CompilerHost as AngularCompilerHost } from '@angular/compiler-cli';
import { normalize } from 'path';
import { createHash } from 'node:crypto';
import { InlineStyleExtension } from '../models';

/**
 *
 * @param host
 * @param transform
 * @param options
 */
export function augmentHostWithResources(
  host: ts.CompilerHost,
  transform: (
    code: string,
    id: string,
    options?: { ssr?: boolean }
  ) => string | null,
  options: {} & {
    inlineStylesExtension?: InlineStyleExtension;
    isProd?: boolean;
  } = {}
) {
  const resourceHost = host as AngularCompilerHost;

  resourceHost.readResource = async function (fileName: string) {
    const filePath = normalize(fileName);

    const content = this.readFile(filePath);

    if (content === undefined) {
      throw new Error('Unable to locate component resource: ' + fileName);
    }

    return content;
  };

  resourceHost.transformResource = async function (data, context) {
    // Only style resources are supported currently
    if (context.type !== 'style') {
      return null;
    }

    if (options.inlineStylesExtension) {
      // Resource file only exists for external stylesheets
      const filename =
        context.resourceFile ??
        `${context.containingFile.replace(/\.ts$/, () => {
          return `.${options?.inlineStylesExtension}`;
        })}`;

      if (options.inlineStylesExtension === 'css') {
        return { content: data || '' };
      }

      let stylesheetResult;

      try {
        stylesheetResult = transform(data, `${filename}?direct`);
      } catch (e) {
        console.error(`${e}`);
      }

      return { content: stylesheetResult || '' };
    }

    return null;
  };
}

// @TODO check if it is used or dead code
export function augmentProgramWithVersioning(program: ts.Program): void {
  const baseGetSourceFiles = program.getSourceFiles;
  program.getSourceFiles = function (...parameters) {
    const files: readonly (ts.SourceFile & { version?: string })[] =
      baseGetSourceFiles(...parameters);

    for (const file of files) {
      if (file.version === undefined) {
        file.version = createHash('sha256').update(file.text).digest('hex');
      }
    }

    return files;
  };
}

// @TODO check if it is used or dead code
export function augmentHostWithCaching(
  host: ts.CompilerHost,
  cache: Map<string, ts.SourceFile>
): void {
  const baseGetSourceFile = host.getSourceFile;
  host.getSourceFile = function (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
    ...parameters
  ) {
    if (!shouldCreateNewSourceFile && cache.has(fileName)) {
      return cache.get(fileName);
    }

    const file = baseGetSourceFile.call(
      host,
      fileName,
      languageVersion,
      onError,
      true,
      ...parameters
    );

    if (file) {
      cache.set(fileName, file);
    }

    return file;
  };
}
