import { parseNxDirectives } from './nx-directives';

const IMPORTS = 'imports';

/**
 * Whether the comment block that opens `content` has an
 * `@nx-ultracache: imports` directive. False when any `@nx-ultracache` value
 * there is unsupported.
 */
export function hasUltracacheImportsDirective(content: string): boolean {
  const values = parseNxDirectives(content).get('ultracache');
  return (
    values !== undefined && findUnsupportedUltracacheValue(values) === undefined
  );
}

/** The first of the `@nx-ultracache` values that is not supported. */
export function findUnsupportedUltracacheValue(
  values: string[]
): string | undefined {
  return values.find((value) => value !== IMPORTS);
}
