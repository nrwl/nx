import {
  normalizePath,
  type ProjectGraph,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
} from '@nx/devkit';
import {
  appliesTestFileDirective,
  readSourceMapsCache,
  type TestFileDirective,
} from '@nx/devkit/internal';
import { relative } from 'node:path';

export type SplitTarget = [name: string, configuration: TargetConfiguration];

// Keyed by graph: the IDE re-reads the graph, and with it the source maps.
const sourceMapsByGraph = new WeakMap<
  ProjectGraph,
  ReturnType<typeof readSourceMapsCache>
>();

/** The atomized targets (`<target>--<file path>`) that run `sourceFilePath`. */
export function findSplitTargets(
  project: ProjectGraphProjectNode,
  sourceFilePath: string
): SplitTarget[] {
  const filePath = normalizePath(relative(project.data.root, sourceFilePath));
  return Object.entries(project.data.targets ?? {}).filter(([name]) =>
    name.endsWith(`--${filePath}`)
  );
}

/** Whether one of `targets` applies `directive` to the file they run. */
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
