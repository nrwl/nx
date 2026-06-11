import type { Tree } from '../tree';
import type { JsonParseOptions, JsonSerializeOptions } from '../../utils/json';
/**
 * Reads a json file, removes all comments and parses JSON.
 *
 * @param tree - file system tree
 * @param path - file path
 * @param options - Optional JSON Parse Options
 */
export declare function readJson<T extends object = any>(tree: Tree, path: string, options?: JsonParseOptions): T;
/**
 * Writes a JSON value to the file system tree

 * @param tree File system tree
 * @param path Path of JSON file in the Tree
 * @param value Serializable value to write
 * @param options Optional JSON Serialize Options
 */
export declare function writeJson<T extends object = object>(tree: Tree, path: string, value: T, options?: JsonSerializeOptions): void;
/**
 * Updates a JSON value to the file system tree
 *
 * @param tree File system tree
 * @param path Path of JSON file in the Tree
 * @param updater Function that maps the current value of a JSON document to a new value to be written to the document
 * @param options Optional JSON Parse and Serialize Options
 */
export declare function updateJson<T extends object = any, U extends object = T>(tree: Tree, path: string, updater: (value: T) => U, options?: JsonParseOptions & JsonSerializeOptions): void;
