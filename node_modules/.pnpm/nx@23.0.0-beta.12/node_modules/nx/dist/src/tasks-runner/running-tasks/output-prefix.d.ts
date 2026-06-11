import { Transform } from 'stream';
export declare function getColor(projectName: string): import("picocolors/types").Formatter;
/**
 * Formats a chunk by splitting it into lines and optionally prepending a prefix.
 * Returns an array of formatted line strings (including EOL).
 */
export declare function formatPrefixedLines(chunk: string | Buffer, prefix?: string): string[];
/**
 * Splits a chunk into lines, optionally prepends a prefix, and writes each
 * non-empty line to the given writable (defaults to `process.stdout`).
 */
export declare function writePrefixedLines(chunk: string | Buffer, prefix?: string, writable?: NodeJS.WritableStream): void;
export declare function addPrefixTransformer(prefix?: string): Transform;
