import * as path from 'node:path';
import { existsSync } from 'node:fs';

import {
  getWorkspacePackagesMetadata,
  matchImportToWildcardEntryPointsToProjectMap,
} from '../../plugins/js/utils/packages';
import { readJsonFile } from '../../utils/fileutils';
import { logger } from '../../utils/logger';
import { normalizePath } from '../../utils/path';
import {
  findProjectForPath,
  ProjectRootMappings,
} from '../utils/find-project-for-path';

import type { ProjectConfiguration } from '../../config/workspace-json-project-json';

/** The workspace layout a local plugin import is resolved against. */
export type LocalPluginLookup = {
  tsConfigPaths: Record<string, string[]>;
  entryPointsToProjectMap: Record<string, ProjectConfiguration>;
  wildcardEntryPointsToProjectMap: Record<string, ProjectConfiguration>;
};

export function createLocalPluginLookup(
  projects: Record<string, ProjectConfiguration>,
  root: string
): LocalPluginLookup {
  const { entryPointsToProjectMap, wildcardEntryPointsToProjectMap } =
    getWorkspacePackagesMetadata(projects);
  return {
    tsConfigPaths: readRootTsConfigPaths(root),
    entryPointsToProjectMap,
    wildcardEntryPointsToProjectMap,
  };
}

export function findNxProjectForImportPath(
  importPath: string,
  projects: Record<string, ProjectConfiguration>,
  lookup: LocalPluginLookup,
  root: string
): { projectConfig: ProjectConfiguration; tsPathFile?: string } | null {
  const possibleTsPaths =
    lookup.tsConfigPaths[importPath]?.map((p) =>
      normalizePath(path.relative(root, path.join(root, p)))
    ) ?? [];

  const projectRootMappings: ProjectRootMappings = new Map();
  if (possibleTsPaths.length) {
    const projectNameMap = new Map<string, ProjectConfiguration>();
    for (const projectRoot in projects) {
      const project = projects[projectRoot];
      projectRootMappings.set(project.root, project.name);
      projectNameMap.set(project.name, project);
    }
    for (const tsConfigPath of possibleTsPaths) {
      const nxProject = findProjectForPath(tsConfigPath, projectRootMappings);
      if (nxProject) {
        return {
          projectConfig: projectNameMap.get(nxProject)!,
          tsPathFile: tsConfigPath,
        };
      }
    }
  }

  if (lookup.entryPointsToProjectMap[importPath]) {
    return { projectConfig: lookup.entryPointsToProjectMap[importPath] };
  }

  const project = matchImportToWildcardEntryPointsToProjectMap(
    lookup.wildcardEntryPointsToProjectMap,
    importPath
  );
  if (project) {
    return { projectConfig: project };
  }

  logger.verbose(
    'Unable to find local plugin',
    possibleTsPaths,
    projectRootMappings
  );
  return null;
}

function readRootTsConfigPaths(root: string): Record<string, string[]> {
  const tsconfigPath: string | null = ['tsconfig.base.json', 'tsconfig.json']
    .map((x) => path.join(root, x))
    .filter((x) => existsSync(x))[0];
  if (!tsconfigPath) {
    // Workspaces that wire up packages purely through package-manager
    // workspaces + package.json exports have no root tsconfig — they simply
    // have no tsconfig path mappings. Local plugin lookup must fall through
    // to the package-metadata matching in `findNxProjectForImportPath`
    // instead of failing the whole plugin load.
    return {};
  }
  return readJsonFile(tsconfigPath).compilerOptions?.paths ?? {};
}
