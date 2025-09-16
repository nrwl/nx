/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import { readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  AngularRspackPluginOptions,
  HashFormat,
  NormalizedAngularRspackPluginOptions,
  normalizeOptions,
  OutputHashing,
} from '../../models';
import { configureI18n } from '../i18n/create-i18n-options';
import type { Configuration } from '@rspack/core';

/**
 * Delete an output directory, but error out if it's the root of the project.
 */
export async function deleteOutputDir(
  root: string,
  outputPath: string,
  emptyOnlyDirectories?: string[]
): Promise<void> {
  const resolvedOutputPath = resolve(root, outputPath);
  if (resolvedOutputPath === root) {
    throw new Error('Output path MUST not be project root directory!');
  }

  const directoriesToEmpty = emptyOnlyDirectories
    ? new Set(
        emptyOnlyDirectories.map((directory) =>
          join(resolvedOutputPath, directory)
        )
      )
    : undefined;

  // Avoid removing the actual directory to avoid errors in cases where the output
  // directory is mounted or symlinked. Instead the contents are removed.
  let entries;
  try {
    entries = await readdir(resolvedOutputPath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const fullEntry = join(resolvedOutputPath, entry);

    // Leave requested directories. This allows symlinks to continue to function.
    if (directoriesToEmpty?.has(fullEntry)) {
      await deleteOutputDir(resolvedOutputPath, fullEntry);
      continue;
    }

    await rm(fullEntry, { force: true, recursive: true, maxRetries: 3 });
  }
}

export function getOutputHashFormat(
  outputHashing: OutputHashing = 'none',
  length = 8
): HashFormat {
  const hashTemplate = `.[contenthash:${length}]`;

  switch (outputHashing) {
    case 'media':
      return {
        chunk: '',
        extract: '',
        file: hashTemplate,
        script: '',
      };
    case 'bundles':
      return {
        chunk: hashTemplate,
        extract: hashTemplate,
        file: '',
        script: hashTemplate,
      };
    case 'all':
      return {
        chunk: hashTemplate,
        extract: hashTemplate,
        file: hashTemplate,
        script: hashTemplate,
      };
    case 'none':
    default:
      return {
        chunk: '',
        extract: '',
        file: '',
        script: '',
      };
  }
}

export async function normalizeOptionWithI18n(
  options: AngularRspackPluginOptions
) {
  const { options: _options, i18n } = await configureI18n(
    options.root ?? process.cwd(),
    options
  );
  // Update file hashes to include translation file content
  const i18nHash = i18n.shouldInline
    ? Object.values(i18n.locales).reduce(
        (data, locale) =>
          data + locale.files.map((file) => file.integrity || '').join('|'),
        ''
      )
    : () => {
        // no-op as i18n is not inlined
      };

  const normalizedOptions = await normalizeOptions(_options);
  return { i18n, i18nHash, normalizedOptions };
}

export function getCrossOriginLoading(
  normalizedOptions: NormalizedAngularRspackPluginOptions
) {
  let crossOriginLoading: NonNullable<
    Configuration['output']
  >['crossOriginLoading'] = false;
  if (
    normalizedOptions.subresourceIntegrity &&
    normalizedOptions.crossOrigin === 'none'
  ) {
    crossOriginLoading = 'anonymous';
  } else if (normalizedOptions.crossOrigin !== 'none') {
    crossOriginLoading = normalizedOptions.crossOrigin;
  }
  return crossOriginLoading;
}
