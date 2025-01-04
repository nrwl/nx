import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  AggregateCreateNodesError,
  ProjectConfiguration,
  readJsonFile,
  StaticDependency,
  writeJsonFile,
} from '@nx/devkit';

import { hashWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { gradleConfigAndTestGlob } from '../../utils/split-config-files';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getCreateNodesLines } from './get-create-nodes-lines';

// the output json file from the gradle plugin
export interface NodesReportJSON {
  [appName: string]: {
    project: Partial<ProjectConfiguration>;
    dependencies: Array<StaticDependency>;
  };
}

export interface NodesReport {
  projects: Record<string, Partial<ProjectConfiguration>>;
  dependencies: Array<StaticDependency>;
}

export interface NodesReportCache extends NodesReport {
  hash: string;
}

function readNodesReportCache(
  cachePath: string,
  hash: string
): NodesReport | undefined {
  const nodesReportCache: Partial<NodesReportCache> = existsSync(cachePath)
    ? readJsonFile(cachePath)
    : undefined;
  if (!nodesReportCache || nodesReportCache.hash !== hash) {
    return;
  }
  return nodesReportCache as NodesReport;
}

export function writeNodesReportToCache(
  cachePath: string,
  results: NodesReport
) {
  let nodesReportJson: NodesReportCache = {
    hash: gradleCurrentConfigHash,
    ...results,
  };

  writeJsonFile(cachePath, nodesReportJson);
}

let nodesReportCache: NodesReport;
let gradleCurrentConfigHash: string;
let nodesReportCachePath: string = join(
  workspaceDataDirectory,
  'gradle-nodes.hash'
);

export function getCurrentNodesReport() {
  if (!nodesReportCache) {
    throw new AggregateCreateNodesError(
      [
        [
          null,
          new Error(
            `Expected cached gradle report. Please open an issue at https://github.com/nrwl/nx/issues/new/choose`
          ),
        ],
      ],
      []
    );
  }
  return nodesReportCache;
}

/**
 * This function populates the gradle report cache.
 * For each gradlew file, it runs the `projectReportAll` task and processes the output.
 * If `projectReportAll` fails, it runs the `projectReport` task instead.
 * It will throw an error if both tasks fail.
 * It will accumulate the output of all gradlew files.
 * @param workspaceRoot
 * @param gradlewFiles absolute paths to all gradlew files in the workspace
 * @returns Promise<void>
 */
export async function populateNodes(
  workspaceRoot: string,
  gradlewFiles: string[]
): Promise<void> {
  const gradleConfigHash = await hashWithWorkspaceContext(workspaceRoot, [
    gradleConfigAndTestGlob,
  ]);
  nodesReportCache ??= readNodesReportCache(
    nodesReportCachePath,
    gradleConfigHash
  );
  if (
    nodesReportCache &&
    (!gradleCurrentConfigHash || gradleConfigHash === gradleCurrentConfigHash)
  ) {
    return;
  }

  const gradleCreateNodesStart = performance.mark('gradleCreateNodes:start');

  const createNodesLines = await gradlewFiles.reduce(
    async (
      createNodesLines: Promise<string[]>,
      gradlewFile: string
    ): Promise<string[]> => {
      const allLines = await createNodesLines;
      const currentLines = await getCreateNodesLines(gradlewFile);
      return [...allLines, ...currentLines];
    },
    Promise.resolve([])
  );

  const gradleCreateNodesEnd = performance.mark('gradleCreateNodes:end');
  performance.measure(
    'gradleCreateNodes',
    gradleCreateNodesStart.name,
    gradleCreateNodesEnd.name
  );
  gradleCurrentConfigHash = gradleConfigHash;
  nodesReportCache = processCreateNodes(createNodesLines);
  writeNodesReportToCache(nodesReportCachePath, nodesReportCache);
}

export function processCreateNodes(createNodesLines: string[]): NodesReport {
  let index = 0;
  let projects: Record<string, Partial<ProjectConfiguration>> = {};
  let dependencies: Array<StaticDependency> = [];
  while (index < createNodesLines.length) {
    const line = createNodesLines[index].trim();
    if (line.startsWith('> Task ') && line.endsWith(':createNodes')) {
      while (
        index < createNodesLines.length &&
        !createNodesLines[index].includes('.json')
      ) {
        index++;
      }
      const file = createNodesLines[index];
      const nodesReportJson: NodesReportJSON =
        readJsonFile<NodesReportJSON>(file);
      for (const [projectRoot, node] of Object.entries(nodesReportJson)) {
        projects[projectRoot] = node.project;
        dependencies = dependencies.concat(node.dependencies);
      }
    }
    index++;
  }

  return {
    projects,
    dependencies,
  };
}
