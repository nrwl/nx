import type { Target } from 'nx/src/command-line/run';
import { ProjectGraph } from 'nx/src/config/project-graph';
import { readCachedProjectGraph } from 'nx/src/project-graph/project-graph';
import { splitTarget } from 'nx/src/utils/split-target';

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
  projectGraph = readCachedProjectGraph()
): Target {
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
