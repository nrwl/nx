import { Tree } from '@nrwl/tao/src/shared/tree';
import * as stripJsonComments from 'strip-json-comments';

/**
 * Reads a document for host, removes all comments and parses JSON.
 *
 * @param host - file system tree
 * @param path - file path
 */
export function readJson<T = any>(host: Tree, path: string) {
  if (!host.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }
  const contents = stripJsonComments(host.read(path).toString('utf-8'));
  try {
    return JSON.parse(contents) as T;
  } catch (e) {
    throw new Error(`Cannot parse ${path}: ${e.message}`);
  }
}

/**
 * Writes a JSON value to the file system tree

 * @param value Serializable value to write
 */
export function writeJson<T = any>(host: Tree, path: string, value: T) {
  host.write(path, JSON.stringify(value, null, 2));
}

/**
 * Updates a JSON value to the file system tree
 *
 * @param updater Function that maps the current value of a JSON document to a new value to be written to the document
 */
export function updateJson<T = any, U = T>(
  host: Tree,
  path: string,
  updater: (value: T) => U
) {
  const updatedValue = updater(readJson(host, path));
  writeJson(host, path, updatedValue);
}
