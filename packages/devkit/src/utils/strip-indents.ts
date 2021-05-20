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
export function stripIndents(
  strings: TemplateStringsArray,
  ...values: any[]
): string {
  return String.raw(strings, ...values)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}
