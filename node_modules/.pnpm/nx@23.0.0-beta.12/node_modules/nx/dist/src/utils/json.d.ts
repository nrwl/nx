import { stripComments } from 'jsonc-parser';
import type { ParseOptions } from 'jsonc-parser';
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
     * the whitespaces to add as indentation to make the output more readable.
     * @default 2
     */
    spaces?: number;
}
/**
 * Parses the given JSON string and returns the object the JSON content represents.
 * By default javascript-style comments and trailing commas are allowed.
 *
 * @param input JSON content as string
 * @param options JSON parse options
 * @returns Object the JSON content represents
 */
export declare function parseJson<T extends object = any>(input: string, options?: JsonParseOptions): T;
/**
 * Serializes the given data to a JSON string.
 * By default the JSON string is formatted with a 2 space indentation to be easy readable.
 *
 * @param input Object which should be serialized to JSON
 * @param options JSON serialize options
 * @returns the formatted JSON representation of the object
 */
export declare function serializeJson<T extends object = object>(input: T, options?: JsonSerializeOptions): string;
