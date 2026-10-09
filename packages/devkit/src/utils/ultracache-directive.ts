import { parseNxDirectives } from './nx-directives';

const IMPORTS = 'imports';

/**
 * Whether the comment block that opens `content` has an
 * `@nx-ultracache: imports` directive. False when any `@nx-ultracache` value
 * there is unsupported.
 */
export function hasUltracacheImportsDirective(content: string): boolean {
  const values = parseUltracacheDirectives(content);
  return values.length > 0 && values.every((value) => value === IMPORTS);
}

/**
 * Whether the content of the test file `file` has an
 * `@nx-ultracache: imports` directive. Throws when any `@nx-ultracache` value
 * is unsupported.
 */
export function parseUltracacheImportsDirective(
  content: string,
  file: string
): boolean {
  const values = parseUltracacheDirectives(content);
  const unsupported = values.find((value) => value !== IMPORTS);
  if (unsupported !== undefined) {
    throw new Error(
      `${file}: "@nx-ultracache: ${unsupported}" is not supported. Use "@nx-ultracache: ${IMPORTS}".`
    );
  }
  return values.length > 0;
}

function parseUltracacheDirectives(content: string): string[] {
  return parseNxDirectives(content).get('ultracache') ?? [];
}
