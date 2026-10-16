import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TargetConfiguration } from 'nx/src/devkit-exports';
import { emitPluginWorkerLog } from 'nx/src/devkit-internals';
import { parseNxDirectives } from './nx-directives';
import {
  dependsOnProjects,
  scopeTestTargetToProjects,
} from './test-file-depends-on';
import { withoutServerInputs } from './without-server-inputs';

/**
 * `target` with the `@nx-depends-on` and `@nx-ignore-server-inputs`
 * directives of a workspace-relative test file applied. A directive that lists
 * no projects, has a value it does not take, or is not supported
 * (`ignoreServerInputs: false`) is skipped with a warning.
 */
export function applyTestFileDirectives(
  target: TargetConfiguration,
  workspaceRoot: string,
  file: string,
  options: { ignoreServerInputs: boolean }
): TargetConfiguration {
  const directives = parseNxDirectives(
    readFileSync(join(workspaceRoot, file), 'utf-8')
  );
  let result = target;

  const dependsOn = directives.get('depends-on');
  if (dependsOn !== undefined) {
    const projects = dependsOnProjects(dependsOn);
    if (projects.length === 0) {
      emitPluginWorkerLog(
        'warn',
        `${file}: "@nx-depends-on:" lists no projects, so Nx ignores it. List the projects the test depends on, separated by commas.`
      );
    } else {
      result = scopeTestTargetToProjects(result, projects);
    }
  }

  const ignoreServerInputs = directives.get('ignore-server-inputs');
  if (ignoreServerInputs !== undefined) {
    if (!options.ignoreServerInputs) {
      emitPluginWorkerLog(
        'warn',
        `${file}: "@nx-ignore-server-inputs" is not supported in this test file, so Nx ignores it.`
      );
    } else if (ignoreServerInputs.some((value) => value !== '')) {
      emitPluginWorkerLog(
        'warn',
        `${file}: "@nx-ignore-server-inputs" takes no value, so Nx ignores it. Write "// @nx-ignore-server-inputs" alone.`
      );
    } else if (result.dependsOn) {
      result = { ...result, dependsOn: withoutServerInputs(result.dependsOn) };
    }
  }

  return result;
}
