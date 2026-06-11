"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripIndents = stripIndents;
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
function stripIndents(strings, ...values) {
    return String.raw(strings, ...values)
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim();
}
