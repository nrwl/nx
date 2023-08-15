import type { Target } from 'nx/src/command-line/run/run';
import type { ProjectGraph } from 'nx/src/config/project-graph';
import { requireNx } from '../../nx';

let { readCachedProjectGraph, splitTarget } = requireNx();

// TODO: Remove this in Nx 18 when Nx 16.7.0 is no longer supported
splitTarget = splitTarget ?? require('nx/src/utils/split-target').splitTarget;

/**
 * @deprecated(v17) A project graph should be passed to parseTargetString for best accuracy.
 */
export function parseTargetString(targetString: string): Target;
/**
 * Parses a target string into {project, target, configuration}
 *
 * Examples:
 * ```typescript
 * parseTargetString("proj:test", graph) // returns { project: "proj", target: "test" }
 * parseTargetString("proj:test:production", graph) // returns { project: "proj", target: "test", configuration: "production" }
 * ```
 *
 * @param targetString - target reference
 */
export function parseTargetString(
  targetString: string,
  projectGraph: ProjectGraph
): Target;
export function parseTargetString(
  targetString: string,
  projectGraph?: ProjectGraph
): Target {
  if (!projectGraph) {
    try {
      projectGraph = readCachedProjectGraph();
    } catch (e) {
      projectGraph = { nodes: {} } as any;
    }
  }
  const [project, target, configuration] = splitTarget(
    targetString,
    projectGraph
  );
  if (!project || !target) {
    throw new Error(`Invalid Target String: ${targetString}`);
  }
  return {
    project,
    target,
    configuration,
  };
}

/**
 * Returns a string in the format "project:target[:configuration]" for the target
 *
 * @param target - target object
 *
 * Examples:
 *
 * ```typescript
 * targetToTargetString({ project: "proj", target: "test" }) // returns "proj:test"
 * targetToTargetString({ project: "proj", target: "test", configuration: "production" }) // returns "proj:test:production"
 * ```
 */
export function targetToTargetString({
  project,
  target,
  configuration,
}: Target): string {
  return `${project}:${target.indexOf(':') > -1 ? `"${target}"` : target}${
    configuration !== undefined ? ':' + configuration : ''
  }`;
}
