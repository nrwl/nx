import {
  ProjectFileMap,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import { isTerminalRun } from './runtime-lint-utils';
import chalk = require('chalk');
import {
  createProjectRootMappings,
  ProjectRootMappings,
} from 'nx/src/project-graph/utils/find-project-for-path';
import { readNxJson } from 'nx/src/config/configuration';
import { TargetProjectLocator } from '@nx/js/src/internal';
import { readFileMapCache } from 'nx/src/project-graph/nx-deps-cache';

export function ensureGlobalProjectGraph(ruleName: string) {
  /**
   * Only reuse graph when running from terminal
   * Enforce every IDE change to get a fresh nxdeps.json
   */
  if (
    !globalThis.projectGraph ||
    !globalThis.projectRootMappings ||
    !globalThis.projectFileMap ||
    !isTerminalRun()
  ) {
    const nxJson = readNxJson();
    globalThis.workspaceLayout = nxJson.workspaceLayout;

    /**
     * Because there are a number of ways in which the rule can be invoked (executor vs ESLint CLI vs IDE Plugin),
     * the ProjectGraph may or may not exist by the time the lint rule is invoked for the first time.
     */
    try {
      const projectGraph = readCachedProjectGraph();
      globalThis.projectGraph = projectGraph;
      globalThis.projectRootMappings = createProjectRootMappings(
        projectGraph.nodes
      );
      globalThis.projectFileMap = readFileMapCache().fileMap.projectFileMap;
      globalThis.targetProjectLocator = new TargetProjectLocator(
        projectGraph.nodes,
        projectGraph.externalNodes
      );
    } catch {
      const WARNING_PREFIX = `${chalk.reset.keyword('orange')('warning')}`;
      const RULE_NAME_SUFFIX = `${chalk.reset.dim(`@nx/${ruleName}`)}`;
      process.stdout
        .write(`${WARNING_PREFIX} No cached ProjectGraph is available. The rule will be skipped.
          If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
          ${RULE_NAME_SUFFIX}\n`);
    }
  }
}

export function readProjectGraph(ruleName: string): {
  projectGraph: ProjectGraph;
  projectFileMap: ProjectFileMap;
  projectRootMappings: ProjectRootMappings;
  targetProjectLocator: TargetProjectLocator;
} {
  ensureGlobalProjectGraph(ruleName);
  return {
    projectGraph: globalThis.projectGraph,
    projectFileMap: globalThis.projectFileMap,
    projectRootMappings: globalThis.projectRootMappings,
    targetProjectLocator: globalThis.targetProjectLocator,
  };
}
