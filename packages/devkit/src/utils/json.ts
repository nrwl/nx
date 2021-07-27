import type { Tree } from '@nrwl/tao/src/shared/tree';
import { parseJson, serializeJson } from '@nrwl/tao/src/utils/json';
import type {
  JsonParseOptions,
  JsonSerializeOptions,
} from '@nrwl/tao/src/utils/json';

/**
 * Reads a document for host, removes all comments and parses JSON.
 *
 * @param host - file system tree
 * @param path - file path
 * @param options - Optional JSON Parse Options
 */
export function readJson<T extends object = any>(
  host: Tree,
  path: string,
  options?: JsonParseOptions
): T {
  if (!host.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }
  try {
    return parseJson(host.read(path, 'utf-8'), options);
  } catch (e) {
    throw new Error(`Cannot parse ${path}: ${e.message}`);
  }
}

/**
 * Writes a JSON value to the file system tree

 * @param host File system tree
 * @param path Path of JSON file in the Tree
 * @param value Serializable value to write
 * @param options Optional JSON Serialize Options
 */
export function writeJson<T extends object = object>(
  host: Tree,
  path: string,
  value: T,
  options?: JsonSerializeOptions
): void {
  host.write(path, serializeJson(value, options));
}

/**
 * Updates a JSON value to the file system tree
 *
 * @param host File system tree
 * @param path Path of JSON file in the Tree
 * @param updater Function that maps the current value of a JSON document to a new value to be written to the document
 * @param options Optional JSON Parse and Serialize Options
 */
export function updateJson<T extends object = any, U extends object = T>(
  host: Tree,
  path: string,
  updater: (value: T) => U,
  options?: JsonParseOptions & JsonSerializeOptions
): void {
  const updatedValue = updater(readJson(host, path, options));
  writeJson(host, path, updatedValue, options);
}
