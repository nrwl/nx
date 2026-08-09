import {
  ProjectFileMap,
  ProjectGraph,
  readCachedProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import { isTerminalRun } from './runtime-lint-utils';
import pc from 'picocolors';
import { TargetProjectLocator } from '@nx/js/internal';
import {
  createProjectRootMappings,
  ProjectRootMappings,
  readNxJsonFromDisk as readNxJson,
  readFileMapCache,
  nxFileMap,
  nxProjectGraph,
} from '@nx/devkit/internal';
import { statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * nx.json is fingerprinted alongside the graph caches because workspaceLayout
 * is read from it whenever the graph is (re)loaded.
 */
function graphCacheFingerprint(): string {
  return [nxProjectGraph, nxFileMap, join(workspaceRoot, 'nx.json')]
    .map((file) => {
      const stat = statSync(file, { throwIfNoEntry: false });
      return stat ? `${stat.mtimeMs}-${stat.size}` : 'missing';
    })
    .join(';');
}

export function ensureGlobalProjectGraph(ruleName: string) {
  const hasCachedGraph =
    !!globalThis.projectGraph &&
    !!globalThis.projectRootMappings &&
    !!globalThis.projectFileMap;

  // Terminal runs (ESLint CLI, jest, nx executor) keep the first graph for the
  // life of the process so every file is linted against a consistent graph.
  if (hasCachedGraph && isTerminalRun()) {
    return;
  }

  // Long-lived hosts (IDE language servers, other lint runners) must pick up
  // workspace changes, but only the cache files on disk can deliver them —
  // reload when those change rather than re-parsing them for every linted file.
  const fingerprint = graphCacheFingerprint();
  if (hasCachedGraph && globalThis.projectGraphFingerprint === fingerprint) {
    return;
  }

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
    globalThis.projectGraphFingerprint = fingerprint;
  } catch {
    const WARNING_PREFIX = `${pc.reset(pc.yellow('warning'))}`;
    const RULE_NAME_SUFFIX = `${pc.reset(pc.dim(`@nx/${ruleName}`))}`;
    process.stdout
      .write(`${WARNING_PREFIX} No cached ProjectGraph is available. The rule will be skipped.
          If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
          ${RULE_NAME_SUFFIX}\n`);
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
