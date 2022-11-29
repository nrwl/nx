import { load as parse, dump as stringify } from 'js-yaml';
import type { LoadOptions as ParseOptions } from 'js-yaml';

export const stripComments = null;

export interface YamlParseOptions extends ParseOptions {
}

export interface YamlSerializeOptions {
  /**
   * the whitespaces to add as intentation to make the output more readable.
   * @default 2
   */
  indent?: number;
}

/**
 * Parses the given YAML string and returns the object the YAML content represents.
 *
 * @param input YAML content as string
 * @param options YAML parse options
 * @returns Object the YAML content represents
 */
export function parseYaml<T extends object = any>(
  input: string,
  options?: YamlParseOptions
): T {
  // this throws YAMLException on parse error
  return parse(input, options) as T;
}

/**
 * Serializes the given data to a YAML string.
 * By default the YAML string is formatted with a 2 space intendation to be easy readable.
 *
 * @param input Object which should be serialized to YAML
 * @param options YAML serialize options
 * @returns the formatted YAML representation of the object
 */
export function serializeYaml<T extends object = object>(
  input: T,
  options?: YamlSerializeOptions
): string {
  return stringify(input, options) + '\n';
}
