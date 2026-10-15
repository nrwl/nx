import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TargetConfiguration } from 'nx/src/devkit-exports';
import { emitPluginWorkerLog } from 'nx/src/devkit-internals';
import { parseNxDirectives } from './nx-directives';
import {
  readDependsOnDirective,
  scopeTestTargetToProjects,
} from './test-file-depends-on';
import { withoutServerInputs } from './without-server-inputs';

/**
 * `target` with the `@nx-depends-on` directive of a workspace-relative test
 * file applied. A directive that lists no projects, mixes `NONE` with projects,
 * or uses `NONE` without `dependsOnNone` is skipped with a warning.
 */
export function applyTestFileDirectives(
  target: TargetConfiguration,
  workspaceRoot: string,
  file: string,
  options: { dependsOnNone: boolean }
): TargetConfiguration {
  const values = parseNxDirectives(
    readFileSync(join(workspaceRoot, file), 'utf-8')
  ).get('depends-on');
  if (values === undefined) {
    return target;
  }
  const directive = readDependsOnDirective(values);
  switch (directive.kind) {
    case 'projects':
      return scopeTestTargetToProjects(target, directive.projects);
    case 'none':
      if (!options.dependsOnNone) {
        emitPluginWorkerLog(
          'warn',
          `${file}: "@nx-depends-on: NONE" is not supported in this test file, so Nx ignores it.`
        );
        return target;
      }
      return target.dependsOn
        ? { ...target, dependsOn: withoutServerInputs(target.dependsOn) }
        : target;
    case 'empty':
      emitPluginWorkerLog(
        'warn',
        `${file}: "@nx-depends-on:" lists no projects, so Nx ignores it. List the projects the test depends on, separated by commas.`
      );
      return target;
    case 'mixed':
      emitPluginWorkerLog(
        'warn',
        `${file}: "@nx-depends-on" combines NONE with project names, so Nx ignores it. Use NONE alone or list only projects.`
      );
      return target;
    default: {
      const unhandled: never = directive;
      throw new Error(
        `Unhandled @nx-depends-on directive: ${JSON.stringify(unhandled)}`
      );
    }
  }
}
