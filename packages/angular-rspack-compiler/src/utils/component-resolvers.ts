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

import { dirname, resolve } from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import { normalize } from 'path';
import { getAllTextByProperty, getTextByProperty } from './utils';

interface StyleUrlsCacheEntry {
  matchedStyleUrls: string[];
  styleUrls: string[];
}

export class StyleUrlsResolver {
  // These resolvers may be called multiple times during the same
  // compilation for the same files. Caching is required because these
  // resolvers use synchronous system calls to the filesystem, which can
  // degrade performance when running compilations for multiple files.
  private readonly styleUrlsCache = new Map<string, StyleUrlsCacheEntry>();

  resolve(code: string, id: string): string[] {
    // Given the code is the following:
    // @Component({
    //   styleUrls: [
    //     './app.component.scss'
    //   ]
    // })
    // The `matchedStyleUrls` would result in: `styleUrls: [\n    './app.component.scss'\n  ]`.
    const matchedStyleUrls = getStyleUrls(code)
      // for type narrowing
      .filter((v) => v !== undefined);
    const entry = this.styleUrlsCache.get(id);
    // We're using `matchedStyleUrls` as a key because the code may be changing continuously,
    // resulting in the resolver being called multiple times. While the code changes, the
    // `styleUrls` may remain constant, which means we should always return the previously
    // resolved style URLs.
    if (
      entry &&
      entry.matchedStyleUrls.join(',') === matchedStyleUrls.join(',')
    ) {
      return entry.styleUrls;
    }

    const styleUrls = matchedStyleUrls.map((styleUrlPath) => {
      return `${styleUrlPath}|${normalize(resolve(dirname(id), styleUrlPath))}`;
    });

    this.styleUrlsCache.set(id, { styleUrls, matchedStyleUrls });
    return styleUrls;
  }
}

export function getStyleUrls(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('cmp.ts', code);
  const properties = sourceFile.getDescendantsOfKind(
    SyntaxKind.PropertyAssignment
  );
  const styleUrl = getTextByProperty('styleUrl', properties);
  const styleUrls = getAllTextByProperty('styleUrls', properties);
  return [...styleUrls, ...styleUrl];
}

export function getTemplateUrls(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('cmp.ts', code);
  const properties = sourceFile.getDescendantsOfKind(
    SyntaxKind.PropertyAssignment
  );
  return getTextByProperty('templateUrl', properties);
}

export interface TemplateUrlsCacheEntry {
  code: string;
  templateUrlPaths: string[];
}

export class TemplateUrlsResolver {
  private readonly templateUrlsCache = new Map<
    string,
    TemplateUrlsCacheEntry
  >();

  resolve(code: string, id: string): string[] {
    const entry = this.templateUrlsCache.get(id);
    if (entry?.code === code) {
      return entry.templateUrlPaths;
    }

    const templateUrlPaths = getTemplateUrls(code).map(
      (url) =>
        `${url}|${normalize(resolve(dirname(id), url).replace(/\\/g, '/'))}`
    );

    this.templateUrlsCache.set(id, { code, templateUrlPaths });
    return templateUrlPaths;
  }
}
