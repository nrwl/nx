import type { Tree } from '@nx/devkit';
import { parseTsConfigContent } from '@nx/devkit/internal';
import { dirname } from 'path';
import type { CompilerOptions } from 'typescript';
import { createTreeParseConfigHost, readTsConfig } from './ts-config';

const enumOptions = new Set<string>([
  'importsNotUsedAsValues',
  'jsx',
  'module',
  'moduleDetection',
  'moduleResolution',
  'newLine',
  'target',
]);

/**
 * Cleans up the provided compiler options to only include the options that are
 * different or not set in the provided tsconfig file.
 */
export function getNeededCompilerOptionOverrides(
  tree: Tree,
  compilerOptions: Record<keyof CompilerOptions, any>,
  tsConfigPath: string
): Record<keyof CompilerOptions, any> {
  const host = createTreeParseConfigHost(tree);
  const parsed = readTsConfig(tsConfigPath, host);
  // TypeScript accepts several spellings of an enum value and numbers some
  // enums differently between versions, so it parses the given values too.
  const given = parseTsConfigContent(
    { compilerOptions, files: [] },
    dirname(tsConfigPath),
    host
  );

  let result = {};
  for (const key of Object.keys(compilerOptions)) {
    if (enumOptions.has(key)) {
      if (
        parsed.options[key] === undefined ||
        parsed.options[key] !== given.options[key]
      ) {
        result[key] = compilerOptions[key];
      }
    } else if (parsed.options[key] !== compilerOptions[key]) {
      result[key] = compilerOptions[key];
    }
  }

  return result;
}
