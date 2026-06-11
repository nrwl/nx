/**
 * Minimal line-diff implementation for nx release output.
 *
 * Replaces jest-diff to eliminate transitive dependencies (pretty-format,
 * chalk, ansi-styles@5) that cause version conflicts for supply chain
 * hardening.
 *
 * Uses @jest/diff-sequences (zero deps) for the core LCS algorithm.
 *
 * Source algorithm: https://github.com/jestjs/jest/tree/main/packages/jest-diff
 */
interface DiffOptions {
    contextLines?: number;
    expand?: boolean;
    aColor?: (s: string) => string;
    bColor?: (s: string) => string;
    patchColor?: (s: string) => string;
    omitAnnotationLines?: boolean;
}
export declare function diff(a: string, b: string, options?: DiffOptions): string;
export {};
