import {
  ExecutorContext,
  ProjectGraph,
  readCachedProjectGraph,
  Target,
} from 'nx/src/devkit-exports';
import { splitByColons, splitTarget } from 'nx/src/devkit-internals';

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
/**
 * Parses a target string into {project, target, configuration}. Passing a full
 * {@link ExecutorContext} enables the targetString to reference the current project.
 *
 * Examples:
 * ```typescript
 * parseTargetString("test", executorContext) // returns { project: "proj", target: "test" }
 * parseTargetString("proj:test", executorContext) // returns { project: "proj", target: "test" }
 * parseTargetString("proj:test:production", executorContext) // returns { project: "proj", target: "test", configuration: "production" }
 * ```
 */
export function parseTargetString(
  targetString: string,
  ctx: ExecutorContext
): Target;
export function parseTargetString(
  targetString: string,
  projectGraphOrCtx?: ProjectGraph | ExecutorContext
): Target {
  let projectGraph =
    projectGraphOrCtx && 'projectGraph' in projectGraphOrCtx
      ? projectGraphOrCtx.projectGraph
      : (projectGraphOrCtx as ProjectGraph);

  if (!projectGraph) {
    try {
      projectGraph = readCachedProjectGraph();
    } catch (e) {
      projectGraph = { nodes: {} } as any;
    }
  }

  const [maybeProject] = splitByColons(targetString);
  if (
    !projectGraph.nodes[maybeProject] &&
    projectGraphOrCtx &&
    'projectName' in projectGraphOrCtx &&
    maybeProject !== projectGraphOrCtx.projectName
  ) {
    targetString = `${projectGraphOrCtx.projectName}:${targetString}`;
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
