import { parseJson, serializeJson } from './json';
import type { JsonParseOptions, JsonSerializeOptions } from './json';
import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { ensureDirSync } from 'fs-extra';

/**
 * Reads a JSON file and returns the object the JSON content represents.
 *
 * @param path A path to a file.
 * @param options JSON parse options
 * @returns Object the JSON content of the file represents
 */
export function readJsonFile<T extends object = any>(
  path: string,
  options?: JsonParseOptions
): T {
  return parseJson<T>(readFileSync(path, 'utf-8'), options);
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
  options?: JsonSerializeOptions
): void {
  ensureDirSync(dirname(path));
  writeFileSync(path, serializeJson(data, options), { encoding: 'utf-8' });
}
