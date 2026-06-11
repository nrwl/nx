/**
 * Removes indents, which is useful for printing warning and messages.
 *
 * Example:
 *
 * ```typescript
 * stripIndents`
 *  Options:
 *  - option1
 *  - option2
 * `
 * ```
 */
export declare function stripIndents(strings: TemplateStringsArray, ...values: any[]): string;
