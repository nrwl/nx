import { readJson, type Tree } from '@nx/devkit';
import type { ConfigFileNamePatterns } from '@nx/devkit/internal';

export const jestConfigExtensions = [
  'js',
  'ts',
  'mjs',
  'cjs',
  'mts',
  'cts',
] as const;
export type JestConfigExtension = (typeof jestConfigExtensions)[number];

export const jestConfigFileNamePatterns: ConfigFileNamePatterns = {
  defaultName: /^jest\.config\.(cjs|mjs|js|cts|mts|ts)$/,
  mappableName: /^jest\.config.*\.(cjs|mjs|js|cts|mts|ts)$/,
  mappableGlob: 'jest.config*.{cjs,mjs,js,cts,mts,ts}',
};

export const jestPresetExtensions = ['js', 'cjs', 'mjs'] as const;
export type JestPresetExtension = (typeof jestPresetExtensions)[number];

export function getPresetExt(tree: Tree): JestPresetExtension {
  const ext = jestPresetExtensions.find((ext) =>
    tree.exists(`jest.preset.${ext}`)
  );

  if (ext) {
    return ext;
  }

  const rootPkgJson = readJson(tree, 'package.json');
  if (rootPkgJson.type && rootPkgJson.type === 'module') {
    // use cjs if package.json type is module
    return 'cjs';
  }

  // default to js
  return 'js';
}

export function findRootJestConfig(tree: Tree): string | null {
  const ext = jestConfigExtensions.find((ext) =>
    tree.exists(`jest.config.${ext}`)
  );

  return ext ? `jest.config.${ext}` : null;
}

export function findJestConfig(tree: Tree, projectPath: string): string | null {
  const ext = jestConfigExtensions.find((ext) =>
    tree.exists(`${projectPath}/jest.config.${ext}`)
  );

  return ext ? `${projectPath}/jest.config.${ext}` : null;
}

export function findRootJestPreset(tree: Tree): string | null {
  const ext = jestPresetExtensions.find((ext) =>
    tree.exists(`jest.preset.${ext}`)
  );

  return ext ? `jest.preset.${ext}` : null;
}
