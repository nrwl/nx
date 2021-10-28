import {
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  createReadStream,
  writeFileSync,
  renameSync as fsRenameSync,
} from 'fs';
import { basename, dirname, resolve as pathResolve } from 'path';
import { serializeJson, readJsonFile, writeJsonFile } from '@nrwl/devkit';

export { readJsonFile, writeJsonFile, serializeJson };

export function writeToFile(filePath: string, str: string) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, str);
}

/**
 * This method is specifically for updating a JSON file using the filesystem
 *
 * @remarks
 * If you are looking to update a JSON file in a tree, look for ./ast-utils#updateJsonInTree
 * @param path Path of the JSON file on the filesystem
 * @param callback Manipulation of the JSON data
 */
export function updateJsonFile(path: string, callback: (a: any) => any) {
  const json = readJsonFile(path);
  callback(json);
  writeJsonFile(path, json);
}

export function copyFile(file: string, target: string) {
  const f = basename(file);
  const source = createReadStream(file);
  const dest = createWriteStream(pathResolve(target, f));
  source.pipe(dest);
  source.on('error', (e) => console.error(e));
}

export function directoryExists(name) {
  try {
    return statSync(name).isDirectory();
  } catch (e) {
    return false;
  }
}

export function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

export function renameSync(
  from: string,
  to: string,
  cb: (err: Error | null) => void
) {
  try {
    if (!existsSync(from)) {
      throw new Error(`Path: ${from} does not exist`);
    } else if (existsSync(to)) {
      throw new Error(`Path: ${to} already exists`);
    }

    // Make sure parent path exists
    const parentPath = pathResolve(to, '..');
    mkdirSync(parentPath, { recursive: true });

    fsRenameSync(from, to);
    cb(null);
  } catch (e) {
    cb(e);
  }
}

export function isRelativePath(path: string): boolean {
  return (
    path === '.' ||
    path === '..' ||
    path.startsWith('./') ||
    path.startsWith('../')
  );
}

export const resolve = require.resolve;
