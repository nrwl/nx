import {
  ProjectFileMap,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { isTerminalRun } from './runtime-lint-utils';
import pc from 'picocolors';
import { TargetProjectLocator } from '@nx/js/internal';
import {
  createProjectRootMappings,
  nxFileMap,
  nxProjectGraph,
  parseFileMapCache,
  parseProjectGraphCache,
  ProjectRootMappings,
  readNxJsonFromDisk as readNxJson,
  readFileMapCache,
} from '@nx/devkit/internal';

let graphCache:
  | {
      graphBytes: Buffer;
      projectGraph: ProjectGraph;
      projectRootMappings: ProjectRootMappings;
    }
  | undefined;
let fileMapCache:
  | { mapBytes: Buffer; projectFileMap: ProjectFileMap }
  | undefined;

export function ensureGlobalProjectGraph(
  ruleName: string,
  skipped = 'The rule will be skipped.'
) {
  if (isTerminalRun()) {
    if (
      globalThis.projectGraph &&
      globalThis.projectRootMappings &&
      globalThis.projectFileMap
    ) {
      return;
    }
    loadFromReaders(ruleName, skipped);
    return;
  }

  globalThis.workspaceLayout = readNxJson().workspaceLayout;

  try {
    const graphBytes = readFileSync(nxProjectGraph);
    const mapBytes = readFileSync(nxFileMap);

    const graph = graphCache?.graphBytes.equals(graphBytes)
      ? graphCache
      : parseGraph(graphBytes);
    const fileMap = fileMapCache?.mapBytes.equals(mapBytes)
      ? fileMapCache
      : parseFileMap(mapBytes);
    // A new locator on every call: it caches tsconfig paths and misses.
    const targetProjectLocator = new TargetProjectLocator(
      graph.projectGraph.nodes,
      graph.projectGraph.externalNodes
    );

    graphCache = graph;
    fileMapCache = fileMap;
    globalThis.projectGraph = graph.projectGraph;
    globalThis.projectRootMappings = graph.projectRootMappings;
    globalThis.projectFileMap = fileMap.projectFileMap;
    globalThis.targetProjectLocator = targetProjectLocator;
  } catch {
    graphCache = undefined;
    fileMapCache = undefined;
    globalThis.projectGraph = undefined;
    globalThis.projectRootMappings = undefined;
    globalThis.projectFileMap = undefined;
    globalThis.targetProjectLocator = undefined;
    warnNoProjectGraph(ruleName, skipped);
  }
}

function parseGraph(graphBytes: Buffer) {
  const cached = parseProjectGraphCache(graphBytes.toString('utf-8'));
  if (!cached) {
    throw new Error('No cached ProjectGraph is available.');
  }
  return {
    graphBytes,
    projectGraph: cached.projectGraph,
    projectRootMappings: createProjectRootMappings(cached.projectGraph.nodes),
  };
}

function parseFileMap(mapBytes: Buffer) {
  const cached = parseFileMapCache(mapBytes.toString('utf-8'));
  if (!cached) {
    throw new Error('No cached file map is available.');
  }
  return { mapBytes, projectFileMap: cached.fileMap.projectFileMap };
}

function loadFromReaders(ruleName: string, skipped: string) {
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
    warnNoProjectGraph(ruleName, skipped);
  }
}

function warnNoProjectGraph(ruleName: string, skipped: string) {
  const WARNING_PREFIX = `${pc.reset(pc.yellow('warning'))}`;
  const RULE_NAME_SUFFIX = `${pc.reset(pc.dim(`@nx/${ruleName}`))}`;
  process.stdout
    .write(`${WARNING_PREFIX} No cached ProjectGraph is available. ${skipped}
          If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
          ${RULE_NAME_SUFFIX}\n`);
}

export function readProjectGraph(
  ruleName: string,
  skipped?: string
): {
  projectGraph: ProjectGraph;
  projectFileMap: ProjectFileMap;
  projectRootMappings: ProjectRootMappings;
  targetProjectLocator: TargetProjectLocator;
} {
  ensureGlobalProjectGraph(ruleName, skipped);
  return {
    projectGraph: globalThis.projectGraph,
    projectFileMap: globalThis.projectFileMap,
    projectRootMappings: globalThis.projectRootMappings,
    targetProjectLocator: globalThis.targetProjectLocator,
  };
}
