/**
 * Parses a target string into {project, target, configuration}
 *
 * @param targetString - target reference
 *
 * Examples:
 *
 * ```typescript
 * parseTargetString("proj:test") // returns { project: "proj", target: "test" }
 * parseTargetString("proj:test:production") // returns { project: "proj", target: "test", configuration: "production" }
 * ```
 */
export function parseTargetString(targetString: string) {
  const [project, target, configuration] = targetString.split(':');
  if (!project || !target) {
    throw new Error(`Invalid Target String: ${targetString}`);
  }
  return {
    project,
    target,
    configuration,
  };
}
