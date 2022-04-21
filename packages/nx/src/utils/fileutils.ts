import { parseJson, serializeJson } from './json';
import type { JsonParseOptions, JsonSerializeOptions } from './json';
import {
  createReadStream,
  createWriteStream,
  readFileSync,
  writeFileSync,
} from 'fs';
import { dirname } from 'path';
import { ensureDirSync } from 'fs-extra';
import { mkdirSync, statSync } from 'fs';
import { resolve as pathResolve } from 'path';
import * as tar from 'tar-stream';
import { createGunzip } from 'zlib';

export interface JsonReadOptions extends JsonParseOptions {
  /**
   * mutable field recording whether JSON ends with new line
   * @default false
   */
  endsWithNewline?: boolean;
}

export interface JsonWriteOptions extends JsonSerializeOptions {
  /**
   * whether to append new line at the end of JSON file
   * @default false
   */
  appendNewLine?: boolean;
}

/**
 * Reads a JSON file and returns the object the JSON content represents.
 *
 * @param path A path to a file.
 * @param options JSON parse options
 * @returns Object the JSON content of the file represents
 */
export function readJsonFile<T extends object = any>(
  path: string,
  options?: JsonReadOptions
): T {
  const content = readFileSync(path, 'utf-8');
  if (options) {
    options.endsWithNewline = content.charCodeAt(content.length - 1) === 10;
  }
  try {
    return parseJson<T>(content, options);
  } catch (e) {
    e.message = e.message.replace('JSON', path);
    throw e;
  }
}

/**
 * Serializes the given data to JSON and writes it to a file.
 *
 * @param path A path to a file.
 * @param data data which should be serialized to JSON and written to the file
 * @param options JSON serialize options
 */
export function writeJsonFile<T extends object = object>(
  path: string,
  data: T,
  options?: JsonWriteOptions
): void {
  ensureDirSync(dirname(path));
  const serializedJson = serializeJson(data, options);
  const content = options?.appendNewLine
    ? `${serializedJson}\n`
    : serializedJson;
  writeFileSync(path, content, { encoding: 'utf-8' });
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
  const parentPath = pathResolve(directoryPath, '..');
  if (!directoryExists(parentPath)) {
    createDirectory(parentPath);
  }
  if (!directoryExists(directoryPath)) {
    mkdirSync(directoryPath);
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

/**
 * Extracts a file from a given tarball to the specified destination.
 * @param tarballPath The path to the tarball from where the file should be extracted.
 * @param file The path to the file inside the tarball.
 * @param destinationFilePath The destination file path.
 * @returns True if the file was extracted successfully, false otherwise.
 */
export async function extractFileFromTarball(
  tarballPath: string,
  file: string,
  destinationFilePath: string
) {
  return new Promise<string>((resolve, reject) => {
    ensureDirSync(dirname(destinationFilePath));
    var tarExtractStream = tar.extract();
    const destinationFileStream = createWriteStream(destinationFilePath);

    let isFileExtracted = false;
    tarExtractStream.on('entry', function (header, stream, next) {
      if (header.name === file) {
        stream.pipe(destinationFileStream);
        stream.on('end', () => {
          isFileExtracted = true;
        });
        destinationFileStream.on('close', () => {
          resolve(destinationFilePath);
        });
      }

      stream.on('end', function () {
        next();
      });

      stream.resume();
    });

    tarExtractStream.on('finish', function () {
      if (!isFileExtracted) {
        reject();
      }
    });

    createReadStream(tarballPath).pipe(createGunzip()).pipe(tarExtractStream);
  });
}
