import {
  createReadStream,
  createWriteStream,
  existsSync,
  renameSync as fsRenameSync,
} from 'fs';
import { basename, resolve as pathResolve } from 'path';
import {
  readJsonFile,
  writeJsonFile,
  fileExists,
  directoryExists,
  isRelativePath,
  createDirectory,
} from 'nx/src/utils/fileutils';

export { fileExists, directoryExists, isRelativePath, createDirectory };

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
    createDirectory(parentPath);

    fsRenameSync(from, to);
    cb(null);
  } catch (e) {
    cb(e);
  }
}
