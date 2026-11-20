import type { Tree } from '@nx/devkit';
import { readTsConfigWithoutFiles } from '@nx/devkit/internal';
import { createTreeParseConfigHost } from '@nx/js/internal';
import { join } from 'node:path';
import type * as ts from 'typescript';

/**
 * Gets the resolved value of a specific compiler option from the TypeScript configuration hierarchy.
 *
 * @param tree - The file system tree
 * @param tsConfigPath - Path to the tsconfig file to resolve
 * @param optionName - Name of the compiler option to retrieve
 * @returns The resolved value of the compiler option, or undefined if not set
 */
export function getDefinedCompilerOption(
  tree: Tree,
  tsConfigPath: string,
  optionName: keyof ts.CompilerOptions
): any | undefined {
  const compilerOptions = readCompilerOptionsFromTsConfig(tree, tsConfigPath);

  return compilerOptions[optionName];
}

/**
 * Reads a tsconfig with its `extends` chain applied. The `files`, `include` and
 * `exclude` entries come back relative to `tsConfigPath` no matter which config
 * in the chain declared them.
 */
export function readResolvedTsConfig(
  tree: Tree,
  tsConfigPath: string
): ts.ParsedCommandLine {
  // an absolute path is what makes the inherited entries come back relative to
  // this config
  return readTsConfigWithoutFiles(
    join(tree.root, tsConfigPath),
    createTreeParseConfigHost(tree)
  );
}

export function readCompilerOptionsFromTsConfig(
  tree: Tree,
  tsConfigPath: string
): ts.CompilerOptions {
  return readTsConfigWithoutFiles(tsConfigPath, createTreeParseConfigHost(tree))
    .options;
}
