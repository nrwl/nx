import {
  NxJsonConfiguration,
  ProjectFileMap,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import { isTerminalRun } from './runtime-lint-utils';
import pc from 'picocolors';
import { TargetProjectLocator } from '@nx/js/internal';
import {
  createProjectRootMappings,
  ProjectRootMappings,
  readNxJsonFromDisk as readNxJson,
  readFileMapCache,
} from '@nx/devkit/internal';

interface ProjectGraphGlobals {
  projectGraph: ProjectGraph;
  projectFileMap: ProjectFileMap;
  projectRootMappings: ProjectRootMappings;
  targetProjectLocator: TargetProjectLocator;
  workspaceLayout: NxJsonConfiguration['workspaceLayout'];
}

const globals = globalThis as typeof globalThis & ProjectGraphGlobals;

export function ensureGlobalProjectGraph(
  ruleName: string,
  skipped = 'The rule will be skipped.'
) {
  /**
   * Only reuse graph when running from terminal
   * Enforce every IDE change to get a fresh nxdeps.json
   */
  if (
    !globals.projectGraph ||
    !globals.projectRootMappings ||
    !globals.projectFileMap ||
    !isTerminalRun()
  ) {
    const nxJson = readNxJson();
    globals.workspaceLayout = nxJson.workspaceLayout;

    /**
     * Because there are a number of ways in which the rule can be invoked (executor vs ESLint CLI vs IDE Plugin),
     * the ProjectGraph may or may not exist by the time the lint rule is invoked for the first time.
     */
    try {
      const projectGraph = readCachedProjectGraph();
      globals.projectGraph = projectGraph;
      globals.projectRootMappings = createProjectRootMappings(
        projectGraph.nodes
      );
      const fileMapCache = readFileMapCache();
      if (!fileMapCache) {
        throw new Error('No cached file map is available.');
      }
      globals.projectFileMap = fileMapCache.fileMap.projectFileMap;
      globals.targetProjectLocator = new TargetProjectLocator(
        projectGraph.nodes,
        projectGraph.externalNodes
      );
    } catch {
      const WARNING_PREFIX = `${pc.reset(pc.yellow('warning'))}`;
      const RULE_NAME_SUFFIX = `${pc.reset(pc.dim(`@nx/${ruleName}`))}`;
      process.stdout
        .write(`${WARNING_PREFIX} No cached ProjectGraph is available. ${skipped}
          If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
          ${RULE_NAME_SUFFIX}\n`);
    }
  }
}

export function readProjectGraph(
  ruleName: string,
  skipped?: string
): Omit<ProjectGraphGlobals, 'workspaceLayout'> {
  ensureGlobalProjectGraph(ruleName, skipped);
  return {
    projectGraph: globals.projectGraph,
    projectFileMap: globals.projectFileMap,
    projectRootMappings: globals.projectRootMappings,
    targetProjectLocator: globals.targetProjectLocator,
  };
}
