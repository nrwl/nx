import {
  normalizePath,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
} from '@nx/devkit';
import {
  appliesTestFileDirective,
  recordedTestFile,
  type TestFileDirective,
} from '@nx/devkit/internal';
import { relative } from 'node:path';

export type SplitTarget = [name: string, configuration: TargetConfiguration];

/**
 * The atomized targets that record `sourceFilePath` as their test file, or else
 * the unrecorded ones named `<target>--<file path>`. A name can end with
 * another file's path, but an unrecorded target applies no directive.
 */
export function findSplitTargets(
  project: ProjectGraphProjectNode,
  sourceFilePath: string
): SplitTarget[] {
  const targets = Object.entries(project.data.targets ?? {});
  const recorded = targets.filter(
    ([, target]) => recordedTestFile(target) === sourceFilePath
  );
  if (recorded.length > 0) {
    return recorded;
  }
  const filePath = normalizePath(relative(project.data.root, sourceFilePath));
  return targets.filter(
    ([name, target]) =>
      recordedTestFile(target) === undefined && name.endsWith(`--${filePath}`)
  );
}

export function splitTargetsApply(
  targets: SplitTarget[],
  directive: TestFileDirective
): boolean {
  return targets.some(([, target]) =>
    appliesTestFileDirective(target, directive)
  );
}
