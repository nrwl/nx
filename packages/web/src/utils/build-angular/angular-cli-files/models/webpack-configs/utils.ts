/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.

import { basename, normalize } from '@angular-devkit/core';
import { ExtraEntryPoint, ExtraEntryPointClass } from '../../../browser/schema';
import { SourceMapDevToolPlugin } from 'webpack';
import { ScriptTarget } from 'typescript';

export interface HashFormat {
  chunk: string;
  extract: string;
  file: string;
  script: string;
}

export function getOutputHashFormat(option: string, length = 20): HashFormat {
  const hashFormats: { [option: string]: HashFormat } = {
    none: { chunk: '', extract: '', file: '', script: '' },
    media: { chunk: '', extract: '', file: `.[hash:${length}]`, script: '' },
    bundles: {
      chunk: `.[chunkhash:${length}]`,
      extract: `.[contenthash:${length}]`,
      file: '',
      script: `.[hash:${length}]`,
    },
    all: {
      chunk: `.[chunkhash:${length}]`,
      extract: `.[contenthash:${length}]`,
      file: `.[hash:${length}]`,
      script: `.[hash:${length}]`,
    },
  };
  return hashFormats[option] || hashFormats['none'];
}

// todo: replace with Omit when we update to TS 3.5
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type NormalizedEntryPoint = Required<Omit<ExtraEntryPointClass, 'lazy'>>;

export function normalizeExtraEntryPoints(
  extraEntryPoints: ExtraEntryPoint[],
  defaultBundleName: string,
): NormalizedEntryPoint[] {
  return extraEntryPoints.map(entry => {
    let normalizedEntry;
    if (typeof entry === 'string') {
      normalizedEntry = { input: entry, inject: true, bundleName: defaultBundleName };
    } else {
      const { lazy, inject = true, ...newEntry } = entry;
      const injectNormalized = entry.lazy !== undefined ? !entry.lazy : inject;
      let bundleName;

      if (entry.bundleName) {
        bundleName = entry.bundleName;
      } else if (!injectNormalized) {
        // Lazy entry points use the file name as bundle name.
        bundleName = basename(
          normalize(entry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '')),
        );
      } else {
        bundleName = defaultBundleName;
      }

      normalizedEntry = { ...newEntry, inject: injectNormalized, bundleName };
    }

    return normalizedEntry;
  });
}

export function getSourceMapDevTool(
  scriptsSourceMap: boolean,
  stylesSourceMap: boolean,
  hiddenSourceMap = false,
  inlineSourceMap = false,
): SourceMapDevToolPlugin {
  const include = [];
  if (scriptsSourceMap) {
    include.push(/js$/);
  }

  if (stylesSourceMap) {
    include.push(/css$/);
  }

  return new SourceMapDevToolPlugin({
    filename: inlineSourceMap ? undefined : '[file].map',
    include,
    // We want to set sourceRoot to  `webpack:///` for non
    // inline sourcemaps as otherwise paths to sourcemaps will be broken in browser
    // `webpack:///` is needed for Visual Studio breakpoints to work properly as currently
    // there is no way to set the 'webRoot'
    sourceRoot: inlineSourceMap ? '' : 'webpack:///',
    moduleFilenameTemplate: '[resource-path]',
    append: hiddenSourceMap ? false : undefined,
  });
}

/**
 * Returns an ES version file suffix to differentiate between various builds.
 */
export function getEsVersionForFileName(
  scriptTargetOverride: ScriptTarget | undefined,
  esVersionInFileName = false,
): string {
  return scriptTargetOverride && esVersionInFileName
    ? '-' + ScriptTarget[scriptTargetOverride].toLowerCase()
    : '';
}

export function isPolyfillsEntry(name: string) {
  return name === 'polyfills' || name === 'polyfills-es5';
}
