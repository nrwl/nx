import { parseJson, serializeJson } from './json';
import type { JsonParseOptions, JsonSerializeOptions } from './json';
import {
  PathLike,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  existsSync,
} from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'path';

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

interface YamlReadOptions {
  /**
   * Compatibility with JSON.parse behaviour. If true, then duplicate keys in a mapping will override values rather than throwing an error.
   */
  json?: boolean;
}

/**
 * Reads a YAML file and returns the object the YAML content represents.
 *
 * @param path A path to a file.
 * @returns
 */
export function readYamlFile<T extends object = any>(
  path: string,
  options?: YamlReadOptions
): T {
  const content = readFileSync(path, 'utf-8');
  const { load } = require('@zkochan/js-yaml');
  return load(content, { ...options, filename: path }) as T;
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
  mkdirSync(dirname(path), { recursive: true });
  const serializedJson = serializeJson(data, options);
  const content = options?.appendNewLine
    ? `${serializedJson}\n`
    : serializedJson;
  writeFileSync(path, content, { encoding: 'utf-8' });
}

/**
 * Serializes the given data to JSON and writes it to a file asynchronously.
 *
 * @param path A path to a file.
 * @param data data which should be serialized to JSON and written to the file
 * @param options JSON serialize options
 */
export async function writeJsonFileAsync<T extends object = object>(
  path: string,
  data: T,
  options?: JsonWriteOptions
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const serializedJson = serializeJson(data, options);
  const content = options?.appendNewLine
    ? `${serializedJson}\n`
    : serializedJson;
  await writeFile(path, content, { encoding: 'utf-8' });
}

/**
 * Check if a directory exists
 * @param path Path to directory
 */
export function directoryExists(path: PathLike): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists.
 * @param path Path to file
 */
export function fileExists(path: PathLike): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function createDirectory(path: PathLike) {
  mkdirSync(path, { recursive: true });
}

export function isRelativePath(path: string): boolean {
  return (
    path === '.' ||
    path === '..' ||
    path.startsWith('./') ||
    path.startsWith('../')
  );
}

export function readFileIfExisting(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}
