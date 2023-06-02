import type { Target } from 'nx/src/command-line/run/run';
import type { ProjectGraph } from 'nx/src/config/project-graph';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { splitTarget } from 'nx/src/utils/split-target';
import { requireNx } from '../../nx';

const { readCachedProjectGraph } = requireNx();

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
