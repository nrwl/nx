/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface PostcssConfiguration {
  plugins: [name: string, options?: object | string][];
}

interface RawPostcssConfiguration {
  plugins?:
    | Record<string, object | boolean | string>
    | (string | [string, object])[];
}

const postcssConfigurationFiles: string[] = [
  'postcss.config.json',
  '.postcssrc.json',
  'postcss.config.js',
];
const tailwindConfigFiles: string[] = [
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts',
];

export interface SearchDirectory {
  root: string;
  files: Set<string>;
}

export async function generateSearchDirectories(
  roots: string[]
): Promise<SearchDirectory[]> {
  return await Promise.all(
    roots.map((root) =>
      readdir(root, { withFileTypes: true }).then((entries) => ({
        root,
        files: new Set(
          entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
        ),
      }))
    )
  );
}

function findFile(
  searchDirectories: SearchDirectory[],
  potentialFiles: string[]
): string | undefined {
  for (const { root, files } of searchDirectories) {
    for (const potential of potentialFiles) {
      if (files.has(potential)) {
        return join(root, potential);
      }
    }
  }

  return undefined;
}

export function findTailwindConfiguration(
  searchDirectories: SearchDirectory[]
): string | undefined {
  return findFile(searchDirectories, tailwindConfigFiles);
}

async function readPostcssConfiguration(
  configurationFile: string
): Promise<RawPostcssConfiguration> {
  const data = await readFile(configurationFile, 'utf-8');
  const config = JSON.parse(data) as RawPostcssConfiguration;

  return config;
}

export async function loadPostcssConfiguration(
  searchDirectories: SearchDirectory[]
): Promise<PostcssConfiguration | undefined> {
  const configPath = findFile(searchDirectories, postcssConfigurationFiles);
  if (!configPath) {
    return undefined;
  }

  const raw = configPath.endsWith('.js')
    ? require(configPath)
    : await readPostcssConfiguration(configPath);

  // If no plugins are defined, consider it equivalent to no configuration
  if (!raw.plugins || typeof raw.plugins !== 'object') {
    return undefined;
  }

  // Normalize plugin array form
  if (Array.isArray(raw.plugins)) {
    if (raw.plugins.length < 1) {
      return undefined;
    }

    const config: PostcssConfiguration = { plugins: [] };
    for (const element of raw.plugins) {
      if (typeof element === 'string') {
        config.plugins.push([element]);
      } else {
        config.plugins.push(element);
      }
    }

    return config;
  }

  // Normalize plugin object map form
  const entries = Object.entries(raw.plugins);
  if (entries.length < 1) {
    return undefined;
  }

  const config: PostcssConfiguration = { plugins: [] };
  for (const [name, options] of entries) {
    if (
      !options ||
      (typeof options !== 'object' && typeof options !== 'string')
    ) {
      continue;
    }

    config.plugins.push([name, options]);
  }

  return config;
}
