import { type JsonWriteOptions } from './fileutils';
/**
 * Writes a JSON file, formatting with Prettier if available, otherwise
 * falling back to standard JSON serialization.
 */
export declare function writeFormattedJsonFile<T extends object = object>(filePath: string, content: T, options?: JsonWriteOptions): Promise<void>;
