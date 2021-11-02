import { parseJson, serializeJson } from './json';
import type { JsonParseOptions, JsonSerializeOptions } from './json';
import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { ensureDirSync } from 'fs-extra';

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
