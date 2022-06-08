import type { Target } from 'nx/src/command-line/run';
import { splitTarget } from 'nx/src/utils/split-target';

/**
 * Parses a target string into {project, target, configuration}
 *
 * Examples:
 * ```typescript
 * parseTargetString("proj:test") // returns { project: "proj", target: "test" }
 * parseTargetString("proj:test:production") // returns { project: "proj", target: "test", configuration: "production" }
 * ```
 *
 * @param targetString - target reference
 */
export function parseTargetString(targetString: string): Target {
  const [project, target, configuration] = splitTarget(targetString);
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
