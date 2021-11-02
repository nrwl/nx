import {
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  createReadStream,
  writeFileSync,
  renameSync as fsRenameSync,
} from 'fs';
import { ensureDirSync } from 'fs-extra';
import { basename, dirname, resolve } from 'path';
import {
  parseJson,
  serializeJson,
  readJsonFile,
  writeJsonFile,
} from '@nrwl/devkit';

export { readJsonFile, writeJsonFile, serializeJson };

export function writeToFile(filePath: string, str: string) {
  ensureDirSync(dirname(filePath));
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
  const dest = createWriteStream(resolve(target, f));
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

export function createDirectory(directoryPath: string) {
  const parentPath = resolve(directoryPath, '..');
  if (!directoryExists(parentPath)) {
    createDirectory(parentPath);
  }
  if (!directoryExists(directoryPath)) {
    mkdirSync(directoryPath);
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
    const parentPath = resolve(to, '..');
    createDirectory(parentPath);

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
