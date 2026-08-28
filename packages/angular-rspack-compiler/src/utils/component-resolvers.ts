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
import * as ts from 'typescript';
import { normalize } from 'path';

interface StyleUrlsCacheEntry {
  matchedStyleUrls: string[];
  styleUrls: string[];
}

export class StyleUrlsResolver {
  private readonly styleUrlsCache = new Map<string, StyleUrlsCacheEntry>();

  resolve(code: string, id: string): string[] {
    const matchedStyleUrls = getStyleUrls(code);
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

// readonly so a caller cannot mutate the memoized arrays out from under the
// next caller
interface ComponentResources {
  readonly styleUrl: readonly string[];
  readonly styleUrls: readonly string[];
  readonly templateUrl: readonly string[];
}

let lastScan: { code: string; resources: ComponentResources } | undefined;

// These resolvers run only when the Angular compilation did not report the
// component's resource dependencies, so they follow @angular/build's JIT
// resource transformer: a resource becomes a module only when its URL is a
// plain string literal, and anything else names no file to watch. Empty is
// skipped for all three properties because it resolves to the component's own
// directory rather than a file; Angular skips it for `templateUrl` and
// `styleUrls` entries but not for `styleUrl`.
function collectUrl(urls: string[], node: ts.Expression): void {
  if (ts.isStringLiteralLike(node) && node.text) {
    urls.push(node.text);
  }
}

// Both resolvers run back to back on the same source in the rspack loader, so
// the last scan is memoized to parse each file once instead of twice.
function scanComponentResources(code: string): ComponentResources {
  if (lastScan !== undefined && lastScan.code === code) {
    return lastScan.resources;
  }

  const sourceFile = ts.createSourceFile(
    'cmp.ts',
    code,
    ts.ScriptTarget.Latest,
    // parent pointers are unused: every value below is read off the node itself
    false,
    ts.ScriptKind.TS
  );
  const styleUrl: string[] = [];
  const styleUrls: string[] = [];
  const templateUrl: string[] = [];

  // Every property assignment in the file is considered, not just the ones in a
  // @Component decorator: Angular identifies that decorator by resolving its
  // symbol to @angular/core, which needs a type checker this parse has no
  // program for.
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      // identifier and quoted keys name the same property, computed ones are
      // dropped, matching how Angular reflects @Component metadata
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    ) {
      const name = node.name.text;
      if (name === 'styleUrl') {
        collectUrl(styleUrl, node.initializer);
      } else if (name === 'templateUrl') {
        collectUrl(templateUrl, node.initializer);
      } else if (
        name === 'styleUrls' &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        for (const element of node.initializer.elements) {
          collectUrl(styleUrls, element);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  const resources: ComponentResources = { styleUrl, styleUrls, templateUrl };
  lastScan = { code, resources };
  return resources;
}

// the explicit return types keep the memoized `readonly string[]` arrays from
// being handed to callers unspread
export function getStyleUrls(code: string): string[] {
  const { styleUrl, styleUrls } = scanComponentResources(code);
  return [...styleUrls, ...styleUrl];
}

export function getTemplateUrls(code: string): string[] {
  return [...scanComponentResources(code).templateUrl];
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
