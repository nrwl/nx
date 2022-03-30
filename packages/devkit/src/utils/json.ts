import type { Tree } from 'nx/src/config/tree';
import { parseJson, serializeJson } from 'nx/src/utils/json';
import type { JsonParseOptions, JsonSerializeOptions } from 'nx/src/utils/json';

/**
 * Reads a json file, removes all comments and parses JSON.
 *
 * @param tree - file system tree
 * @param path - file path
 * @param options - Optional JSON Parse Options
 */
export function readJson<T extends object = any>(
  tree: Tree,
  path: string,
  options?: JsonParseOptions
): T {
  if (!tree.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }
  try {
    return parseJson(tree.read(path, 'utf-8'), options);
  } catch (e) {
    throw new Error(`Cannot parse ${path}: ${e.message}`);
  }
}

/**
 * Writes a JSON value to the file system tree

 * @param tree File system tree
 * @param path Path of JSON file in the Tree
 * @param value Serializable value to write
 * @param options Optional JSON Serialize Options
 */
export function writeJson<T extends object = object>(
  tree: Tree,
  path: string,
  value: T,
  options?: JsonSerializeOptions
): void {
  tree.write(path, serializeJson(value, options));
}

/**
 * Updates a JSON value to the file system tree
 *
 * @param tree File system tree
 * @param path Path of JSON file in the Tree
 * @param updater Function that maps the current value of a JSON document to a new value to be written to the document
 * @param options Optional JSON Parse and Serialize Options
 */
export function updateJson<T extends object = any, U extends object = T>(
  tree: Tree,
  path: string,
  updater: (value: T) => U,
  options?: JsonParseOptions & JsonSerializeOptions
): void {
  const updatedValue = updater(readJson(tree, path, options));
  writeJson(tree, path, updatedValue, options);
}
