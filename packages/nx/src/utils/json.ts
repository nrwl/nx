import { parse, printParseErrorCode, stripComments } from 'jsonc-parser';
import type { ParseError, ParseOptions } from 'jsonc-parser';

export { stripComments as stripJsonComments };

export interface JsonParseOptions extends ParseOptions {
  /**
   * Expect JSON with javascript-style
   * @default false
   */
  expectComments?: boolean;
  /**
   * Disallow javascript-style
   * @default false
   */
  disallowComments?: boolean;

  /**
   * Allow trailing commas in the JSON content
   */
  allowTrailingComma?: boolean;
}

export interface JsonSerializeOptions {
  /**
   * the whitespaces to add as intentation to make the output more readable.
   * @default 2
   */
  spaces?: number;
}

/**
 * Parses the given JSON string and returns the object the JSON content represents.
 * By default javascript-style comments are allowed.
 *
 * @param input JSON content as string
 * @param options JSON parse options
 * @returns Object the JSON content represents
 */
export function parseJson<T extends object = any>(
  input: string,
  options?: JsonParseOptions
): T {
  try {
    return JSON.parse(input);
  } catch {}

  const errors: ParseError[] = [];
  const result: T = parse(input, errors, options);

  if (errors.length > 0) {
    const { error, offset } = errors[0];
    throw new Error(
      `${printParseErrorCode(error)} in JSON at position ${offset}`
    );
  }

  return result;
}

/**
 * Serializes the given data to a JSON string.
 * By default the JSON string is formatted with a 2 space intendation to be easy readable.
 *
 * @param input Object which should be serialized to JSON
 * @param options JSON serialize options
 * @returns the formatted JSON representation of the object
 */
export function serializeJson<T extends object = object>(
  input: T,
  options?: JsonSerializeOptions
): string {
  return JSON.stringify(input, null, options?.spaces ?? 2) + '\n';
}
