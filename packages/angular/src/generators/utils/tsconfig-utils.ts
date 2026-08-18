import type { Tree } from '@nx/devkit';
import { createTreeParseConfigHost, ensureTypescript } from '@nx/js/internal';
import { dirname } from 'node:path';
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

export function readCompilerOptionsFromTsConfig(
  tree: Tree,
  tsConfigPath: string
): ts.CompilerOptions {
  const ts = ensureTypescript();
  const host = createTreeParseConfigHost(tree);

  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile(tsConfigPath, host.readFile).config,
    host,
    dirname(tsConfigPath)
  );

  return parsed.options;
}
