import * as fs from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as path from 'path';
import * as stripJsonComments from 'strip-json-comments';
const ignore = require('ignore');

export function writeToFile(filePath: string, str: string) {
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, str);
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

export function serializeJson(json: any): string {
  return `${JSON.stringify(json, null, 2)}\n`;
}

/**
 * This method is specifically for reading a JSON file from the filesystem
 *
 * @remarks
 * If you are looking to read a JSON file in a Tree, use ./ast-utils#readJsonInTree
 * @param path Path of the JSON file on the filesystem
 */
export function readJsonFile<T = any>(path: string): T {
  return parseJsonWithComments<T>(fs.readFileSync(path, 'utf-8'));
}

export function parseJsonWithComments<T = any>(content: string): T {
  return JSON.parse(stripJsonComments(content));
}

export function writeJsonFile(path: string, json: any) {
  writeToFile(path, serializeJson(json));
}

export function copyFile(file: string, target: string) {
  const f = path.basename(file);
  const source = fs.createReadStream(file);
  const dest = fs.createWriteStream(path.resolve(target, f));
  source.pipe(dest);
  source.on('error', (e) => console.error(e));
}

export function directoryExists(name) {
  try {
    return fs.statSync(name).isDirectory();
  } catch (e) {
    return false;
  }
}

export function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

export function createDirectory(directoryPath: string) {
  const parentPath = path.resolve(directoryPath, '..');
  if (!directoryExists(parentPath)) {
    createDirectory(parentPath);
  }
  if (!directoryExists(directoryPath)) {
    fs.mkdirSync(directoryPath);
  }
}

export function renameSync(
  from: string,
  to: string,
  cb: (err: Error | null) => void
) {
  try {
    if (!fs.existsSync(from)) {
      throw new Error(`Path: ${from} does not exist`);
    } else if (fs.existsSync(to)) {
      throw new Error(`Path: ${to} already exists`);
    }

    // Make sure parent path exists
    const parentPath = path.resolve(to, '..');
    createDirectory(parentPath);

    fs.renameSync(from, to);
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
