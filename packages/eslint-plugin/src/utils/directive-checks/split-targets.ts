import {
  normalizePath,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
} from '@nx/devkit';
import {
  appliesTestFileDirective,
  readSourceMapsCache,
  recordedTestFile,
  type TestFileDirective,
} from '@nx/devkit/internal';
import { relative } from 'node:path';

export type SplitTarget = [name: string, configuration: TargetConfiguration];

// Keyed by graph: the IDE re-reads the graph, and with it the source maps.
const sourceMapsByGraph = new WeakMap<
  ProjectGraph,
  ReturnType<typeof readSourceMapsCache>
>();

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

/**
 * Whether one of `targets` keeps the `always` project inputs its plugin added
 * for `@nx-depends-on`, which the task hasher requires to match a project.
 */
export function splitTargetsKeepDependsOnInputs(
  projectGraph: ProjectGraph,
  project: ProjectGraphProjectNode,
  targets: SplitTarget[]
): boolean {
  if (!sourceMapsByGraph.has(projectGraph)) {
    sourceMapsByGraph.set(projectGraph, readSourceMapsCache());
  }
  const sourceMap = sourceMapsByGraph.get(projectGraph)?.[project.data.root];
  if (!sourceMap) {
    return false;
  }
  return targets.some(([name, target]) => {
    const plugin = sourceMap[`targets.${name}`]?.[1];
    // Each input keeps the source that wrote it, also when a target default
    // spreads the inferred inputs with `'...'`. A replacement records its own.
    const inputsKey = `targets.${name}.inputs`;
    return (
      plugin !== undefined &&
      (target.inputs ?? []).some(
        (input, index) =>
          typeof input !== 'string' &&
          'projects' in input &&
          input.always === true &&
          (sourceMap[`${inputsKey}.${index}`] ?? sourceMap[inputsKey])?.[1] ===
            plugin
      )
    );
  });
}
