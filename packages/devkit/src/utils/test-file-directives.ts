import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TargetConfiguration } from 'nx/src/devkit-exports';
import { emitPluginWorkerLog } from 'nx/src/devkit-internals';
import { parseNxDirectives } from './nx-directives';
import { findUnsupportedUltracacheValue } from './ultracache-directive';
import { withoutServerInputs } from './without-server-inputs';

const TEST_FILE_DIRECTIVES = ['ultracache'] as const;

/** An `@nx-<name>` directive a plugin can apply to a test file's target. */
type TestFileDirective = (typeof TEST_FILE_DIRECTIVES)[number];

/**
 * `target` with the `@nx-*` directives of a workspace-relative test file
 * applied, for the directives in `supported`. A directive that is not
 * supported or has an unsupported value is skipped with a warning.
 */
export function applyTestFileDirectives(
  target: TargetConfiguration,
  workspaceRoot: string,
  file: string,
  supported: readonly TestFileDirective[]
): TargetConfiguration {
  const directives = parseNxDirectives(
    readFileSync(join(workspaceRoot, file), 'utf-8')
  );
  let result = target;
  for (const directive of TEST_FILE_DIRECTIVES) {
    const values = directives.get(directive);
    if (values === undefined) {
      continue;
    }
    if (!supported.includes(directive)) {
      emitPluginWorkerLog(
        'warn',
        `${file}: "@nx-${directive}" is not supported in this test file, so Nx ignores it.`
      );
      continue;
    }
    result = applyDirective(result, directive, values, file);
  }
  return result;
}

function applyDirective(
  target: TargetConfiguration,
  directive: TestFileDirective,
  values: string[],
  file: string
): TargetConfiguration {
  switch (directive) {
    case 'ultracache': {
      const unsupported = findUnsupportedUltracacheValue(values);
      if (unsupported !== undefined) {
        emitPluginWorkerLog(
          'warn',
          `${file}: "@nx-ultracache:${unsupported && ` ${unsupported}`}" is not supported, so Nx ignores "@nx-ultracache" in this file. Use "@nx-ultracache: imports".`
        );
        return target;
      }
      return target.dependsOn
        ? { ...target, dependsOn: withoutServerInputs(target.dependsOn) }
        : target;
    }
    default: {
      const unhandled: never = directive;
      throw new Error(`Unhandled test file directive: ${unhandled}`);
    }
  }
}
