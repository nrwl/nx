import { ProjectGraph, readCachedProjectGraph } from '@nrwl/devkit';
import { isTerminalRun } from './runtime-lint-utils';
import * as chalk from 'chalk';
import {
  createProjectRootMappings,
  ProjectRootMappings,
} from 'nx/src/project-graph/utils/find-project-for-path';
import { readNxJson } from 'nx/src/project-graph/file-utils';

export function ensureGlobalProjectGraph(ruleName: string) {
  /**
   * Only reuse graph when running from terminal
   * Enforce every IDE change to get a fresh nxdeps.json
   */
  if (
    !(global as any).projectGraph ||
    !(global as any).projectRootMappings ||
    !isTerminalRun()
  ) {
    const nxJson = readNxJson();
    (global as any).workspaceLayout = nxJson.workspaceLayout;

    /**
     * Because there are a number of ways in which the rule can be invoked (executor vs ESLint CLI vs IDE Plugin),
     * the ProjectGraph may or may not exist by the time the lint rule is invoked for the first time.
     */
    try {
      (global as any).projectGraph = readCachedProjectGraph();
      (global as any).projectRootMappings = createProjectRootMappings(
        (global as any).projectGraph.nodes
      );
    } catch {
      const WARNING_PREFIX = `${chalk.reset.keyword('orange')('warning')}`;
      const RULE_NAME_SUFFIX = `${chalk.reset.dim(`@nrwl/nx/${ruleName}`)}`;
      process.stdout
        .write(`${WARNING_PREFIX} No cached ProjectGraph is available. The rule will be skipped.
          If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
          ${RULE_NAME_SUFFIX}\n`);
    }
  }
}

export function readProjectGraph(ruleName: string): {
  projectGraph: ProjectGraph;
  projectRootMappings: ProjectRootMappings;
} {
  ensureGlobalProjectGraph(ruleName);
  return {
    projectGraph: (global as any).projectGraph,
    projectRootMappings: (global as any).projectRootMappings,
  };
}
