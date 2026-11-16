import { parseNxDirectives } from './nx-directives';

/**
 * Whether the comment block that opens `content` has a bare
 * `@nx-ignore-server-inputs` directive. False when one there has a value.
 */
export function hasIgnoreServerInputsDirective(content: string): boolean {
  const values = parseNxDirectives(content).get('ignore-server-inputs');
  return values !== undefined && values.every((value) => value === '');
}
