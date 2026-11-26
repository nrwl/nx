import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePath, type TargetConfiguration } from 'nx/src/devkit-exports';
import { emitPluginWorkerLog } from 'nx/src/devkit-internals';
import { parseNxDirectives } from './nx-directives';
import {
  dependsOnProjects,
  scopeTestTargetToProjects,
} from './test-file-depends-on';
import { withoutServerInputs } from './without-server-inputs';

export type TestFileDirective = 'depends-on' | 'ignore-server-inputs';

/**
 * `target` with the `@nx-depends-on` and `@nx-ignore-server-inputs`
 * directives of a workspace-relative test file applied. A directive that lists
 * no projects, has a value it does not take, or is not supported
 * (`ignoreServerInputs: false`) is skipped with a warning. The target's
 * metadata records the file, and `ignore-server-inputs` when supported, for
 * `recordedTestFile` and `appliesTestFileDirective`. A file that no longer
 * exists, such as one deleted after the file index listed it, leaves `target`
 * unchanged.
 */
export function applyTestFileDirectives(
  target: TargetConfiguration,
  workspaceRoot: string,
  file: string,
  options: { ignoreServerInputs: boolean }
): TargetConfiguration {
  let content: string;
  try {
    content = readFileSync(join(workspaceRoot, file), 'utf-8');
  } catch (e) {
    if (e?.code === 'ENOENT') {
      return target;
    }
    throw e;
  }
  const directives = parseNxDirectives(content);
  let result: TargetConfiguration = {
    ...target,
    metadata: {
      ...target.metadata,
      testFileDirectives: options.ignoreServerInputs
        ? { file: normalizePath(file), 'ignore-server-inputs': true }
        : { file: normalizePath(file) },
    },
  };

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

/**
 * The workspace-relative test file that `target`'s metadata records.
 */
export function recordedTestFile(
  target: TargetConfiguration
): string | undefined {
  return target.metadata?.testFileDirectives?.file;
}

/**
 * Whether `target` applies `directive` to its test file. `depends-on` applies
 * to every target whose metadata records its test file, and
 * `ignore-server-inputs` only to one whose metadata marks it as applied.
 */
export function appliesTestFileDirective(
  target: TargetConfiguration,
  directive: TestFileDirective
): boolean {
  return directive === 'depends-on'
    ? recordedTestFile(target) !== undefined
    : target.metadata?.testFileDirectives?.[directive] === true;
}
