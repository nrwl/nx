import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  AggregateCreateNodesError,
  ProjectConfiguration,
  ProjectGraphExternalNode,
  readJsonFile,
  StaticDependency,
  writeJsonFile,
} from '@nx/devkit';

import { hashWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { gradleConfigAndTestGlob } from '../../utils/split-config-files';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getNxProjectGraphLines } from './get-project-graph-lines';

// the output json file from the gradle plugin
export interface ProjectGraphReport {
  nodes: {
    [appRoot: string]: Partial<ProjectConfiguration>;
  };
  dependencies: Array<StaticDependency>;
  externalNodes?: Record<string, ProjectGraphExternalNode>;
}

export interface ProjectGraphReportCache extends ProjectGraphReport {
  hash: string;
}

function readProjectGraphReportCache(
  cachePath: string,
  hash: string
): ProjectGraphReport | undefined {
  const projectGraphReportCache: Partial<ProjectGraphReportCache> = existsSync(
    cachePath
  )
    ? readJsonFile(cachePath)
    : undefined;
  if (!projectGraphReportCache || projectGraphReportCache.hash !== hash) {
    return;
  }
  return projectGraphReportCache as ProjectGraphReport;
}

export function writeProjectGraphReportToCache(
  cachePath: string,
  results: ProjectGraphReport
) {
  let projectGraphReportJson: ProjectGraphReportCache = {
    hash: gradleCurrentConfigHash,
    ...results,
  };

  writeJsonFile(cachePath, projectGraphReportJson);
}

let projectGraphReportCache: ProjectGraphReport;
let gradleCurrentConfigHash: string;
let projectGraphReportCachePath: string = join(
  workspaceDataDirectory,
  'gradle-nodes.hash'
);

export function getCurrentProjectGraphReport(): ProjectGraphReport {
  if (!projectGraphReportCache) {
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
  return projectGraphReportCache;
}

/**
 * This function populates the gradle report cache.
 * For each gradlew file, it runs the `nxProjectGraph` task and processes the output.
 * It will throw an error if both tasks fail.
 * It will accumulate the output of all gradlew files.
 * @param workspaceRoot
 * @param gradlewFiles absolute paths to all gradlew files in the workspace
 * @returns Promise<void>
 */
export async function populateProjectGraph(
  workspaceRoot: string,
  gradlewFiles: string[]
): Promise<void> {
  const gradleConfigHash = await hashWithWorkspaceContext(workspaceRoot, [
    gradleConfigAndTestGlob,
  ]);
  projectGraphReportCache ??= readProjectGraphReportCache(
    projectGraphReportCachePath,
    gradleConfigHash
  );
  if (
    projectGraphReportCache &&
    (!gradleCurrentConfigHash || gradleConfigHash === gradleCurrentConfigHash)
  ) {
    return;
  }

  const gradleProjectGraphReportStart = performance.mark(
    'gradleProjectGraphReport:start'
  );

  const projectGraphLines = await gradlewFiles.reduce(
    async (
      projectGraphLines: Promise<string[]>,
      gradlewFile: string
    ): Promise<string[]> => {
      const getNxProjectGraphLinesStart = performance.mark(
        `${gradlewFile}GetNxProjectGraphLines:start`
      );
      const allLines = await projectGraphLines;
      const currentLines = await getNxProjectGraphLines(
        gradlewFile,
        gradleConfigHash
      );
      const getNxProjectGraphLinesEnd = performance.mark(
        `${gradlewFile}GetNxProjectGraphLines:end`
      );
      performance.measure(
        `${gradlewFile}GetNxProjectGraphLines`,
        getNxProjectGraphLinesStart.name,
        getNxProjectGraphLinesEnd.name
      );
      return [...allLines, ...currentLines];
    },
    Promise.resolve([])
  );

  const gradleProjectGraphReportEnd = performance.mark(
    'gradleProjectGraphReport:end'
  );
  performance.measure(
    'gradleProjectGraphReport',
    gradleProjectGraphReportStart.name,
    gradleProjectGraphReportEnd.name
  );
  gradleCurrentConfigHash = gradleConfigHash;
  projectGraphReportCache = processNxProjectGraph(projectGraphLines);
  writeProjectGraphReportToCache(
    projectGraphReportCachePath,
    projectGraphReportCache
  );
}

export function processNxProjectGraph(
  projectGraphLines: string[]
): ProjectGraphReport {
  let index = 0;
  let projectGraphReportForAllProjects: ProjectGraphReport = {
    nodes: {},
    dependencies: [],
    externalNodes: {},
  };
  while (index < projectGraphLines.length) {
    const line = projectGraphLines[index].trim();
    if (line.startsWith('> Task ') && line.endsWith(':nxProjectGraph')) {
      while (
        index < projectGraphLines.length &&
        !projectGraphLines[index].includes('.json')
      ) {
        index++;
      }
      const file = projectGraphLines[index];
      const projectGraphReportJson: ProjectGraphReport =
        readJsonFile<ProjectGraphReport>(file);
      projectGraphReportForAllProjects.nodes = {
        ...projectGraphReportForAllProjects.nodes,
        ...projectGraphReportJson.nodes,
      };
      if (projectGraphReportJson.dependencies) {
        projectGraphReportForAllProjects.dependencies.push(
          ...projectGraphReportJson.dependencies
        );
      }
      if (Object.keys(projectGraphReportJson.externalNodes ?? {}).length > 0) {
        projectGraphReportForAllProjects.externalNodes = {
          ...projectGraphReportForAllProjects.externalNodes,
          ...projectGraphReportJson.externalNodes,
        };
      }
    }
    index++;
  }

  return projectGraphReportForAllProjects;
}
