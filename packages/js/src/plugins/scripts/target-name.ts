import { parseNxDirectives } from '@nx/devkit/internal';

export interface TargetNameDirective {
  name?: string;
  warnings: string[];
}

/**
 * Reads `@nx-target-name: <name>` from the comment block that opens the
 * script. Only the first directive counts; problems come back as warnings.
 */
export function parseTargetName(header: string): TargetNameDirective {
  const [value, ...extra] = parseNxDirectives(header).get('target-name') ?? [];
  const warnings = extra.map(
    (v) => `ignoring the extra "@nx-target-name: ${v}" directive`
  );
  if (value === undefined) {
    return { warnings };
  }
  if (!value) {
    return { warnings: ['"@nx-target-name" is empty', ...warnings] };
  }
  return { name: value, warnings };
}
