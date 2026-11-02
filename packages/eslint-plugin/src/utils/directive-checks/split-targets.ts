import {
  normalizePath,
  type ProjectGraph,
  type ProjectGraphProjectNode,
} from '@nx/devkit';
import {
  readSourceMapsCache,
  testFileDirectiveSupport,
  type TestFileDirective,
  type TestFileDirectivePlugin,
} from '@nx/devkit/internal';
import { relative } from 'node:path';

export interface SplitTarget {
  name: string;
  /** Undefined when no source map is cached or another plugin created it. */
  plugin: TestFileDirectivePlugin | undefined;
  /**
   * Whether the target keeps the `always` project inputs its plugin added for
   * `@nx-depends-on`, which the task hasher requires to match a project.
   */
  keepsDependsOnInputs: boolean;
}

// Keyed by graph: the IDE re-reads the graph, and with it the source maps.
const sourceMapsByGraph = new WeakMap<
  ProjectGraph,
  ReturnType<typeof readSourceMapsCache>
>();

/**
 * The atomized targets (`<target>--<file path>`) that run `sourceFilePath`,
 * with the plugin that created each one.
 */
export function findSplitTargets(
  projectGraph: ProjectGraph,
  project: ProjectGraphProjectNode,
  sourceFilePath: string
): SplitTarget[] {
  const filePath = normalizePath(relative(project.data.root, sourceFilePath));
  const names = Object.keys(project.data.targets ?? {}).filter((target) =>
    target.endsWith(`--${filePath}`)
  );
  if (names.length === 0) {
    return [];
  }
  if (!sourceMapsByGraph.has(projectGraph)) {
    sourceMapsByGraph.set(projectGraph, readSourceMapsCache());
  }
  const sourceMap = sourceMapsByGraph.get(projectGraph)?.[project.data.root];
  return names.map((name) => {
    const source = sourceMap?.[`targets.${name}`]?.[1];
    const plugin = Object.hasOwn(testFileDirectiveSupport, source ?? '')
      ? (source as TestFileDirectivePlugin)
      : undefined;
    // Each input keeps the source that wrote it, also when a target default
    // spreads the inferred inputs with `'...'`. A replacement records its own.
    const inputsKey = `targets.${name}.inputs`;
    const keepsDependsOnInputs =
      plugin !== undefined &&
      (project.data.targets[name].inputs ?? []).some(
        (input, index) =>
          typeof input !== 'string' &&
          'projects' in input &&
          input.always === true &&
          (sourceMap[`${inputsKey}.${index}`] ?? sourceMap[inputsKey])?.[1] ===
            plugin
      );
    return { name, plugin, keepsDependsOnInputs };
  });
}

function appliesDirective(
  target: SplitTarget,
  directive: TestFileDirective
): boolean {
  return (
    target.plugin !== undefined &&
    testFileDirectiveSupport[target.plugin][directive]
  );
}

/**
 * Whether Nx applies `directive` to the file `targets` run: true when one of
 * their plugins does, false when every plugin is known and none does,
 * undefined when there is no target or a plugin is unknown.
 */
export function splitTargetsApply(
  targets: SplitTarget[],
  directive: TestFileDirective
): boolean | undefined {
  if (targets.some((target) => appliesDirective(target, directive))) {
    return true;
  }
  return targets.length > 0 &&
    targets.every((target) => target.plugin !== undefined)
    ? false
    : undefined;
}
