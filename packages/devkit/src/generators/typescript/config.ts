import type { Tree } from 'nx/src/generators/tree';
import { writeJson } from 'nx/src/generators/utils/json';
import type { JsonSerializeOptions } from 'nx/src/utils/json';
import { dirname } from 'path';

let ts: typeof import('typescript');

/**
 * Reads the provided tsconfig json file.
 *
 * @param tree File system tree.
 * @param tsConfigPath Path to the tsconfig json file.
 * @returns The parsed tsconfig json file.
 */
export function readTsConfigJson<T extends object = any>(
  tree: Tree,
  tsConfigPath: string
): T {
  if (!ts) {
    ts = require('typescript');
  }

  const { config } = ts.readConfigFile(tsConfigPath, (path) =>
    tree.read(path, 'utf-8')
  );

  return config;
}

/**
 * Reads the full TS configuration from the provided tsconfig json file path
 * by loading the base configuration if set.
 *
 * @param tree File system tree.
 * @param tsConfigPath Path to the tsconfig json file.
 * @returns The parsed TS configuration.
 */
export function readTsConfiguration<T extends object = any>(
  tree: Tree,
  tsConfigPath: string
): T {
  const config = readTsConfigJson(tree, tsConfigPath);

  return ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    dirname(tsConfigPath)
  ) as T;
}

/**
 * Updates a tsconfig json file.
 *
 * @param tree File system tree.
 * @param tsConfigPath Path to the tsconfig json file.
 * @param updater Function that maps the current value of the tsconfig json file
 * to a new value to be written to the file.
 * @param options Options to be use when serializing the JSON.
 */
export function updateTsConfigJson<
  T extends object = any,
  U extends object = T
>(
  tree: Tree,
  tsConfigPath: string,
  updater: (value: T) => U,
  options?: JsonSerializeOptions
): void {
  const updatedValue = updater(readTsConfigJson(tree, tsConfigPath));
  writeJson(tree, tsConfigPath, updatedValue, options);
}
