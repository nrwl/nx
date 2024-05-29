import { minimatch } from 'minimatch';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { toProjectName } from '../../config/to-project-name';
import { readJsonFile, readYamlFile } from '../../utils/fileutils';
import { combineGlobPatterns } from '../../utils/globs';
import { NX_PREFIX } from '../../utils/logger';
import { output } from '../../utils/output';
import {
  getMetadataFromPackageJson,
  PackageJson,
  getTagsFromPackageJson,
  readTargetsFromPackageJson,
} from '../../utils/package-json';
import { joinPathFragments } from '../../utils/path';
import { CreateNodes } from '../../project-graph/plugins';

export const createNodes: CreateNodes = [
  combineGlobPatterns('package.json', '**/package.json'),
  (p, _, { workspaceRoot }) => {
    const readJson = (f) => readJsonFile(join(workspaceRoot, f));
    const matcher = buildPackageJsonWorkspacesMatcher(workspaceRoot, readJson);

    if (matcher(p)) {
      return createNodeFromPackageJson(p, workspaceRoot);
    }
    // The given package.json is not part of the workspaces configuration.
    return {};
  },
];

export function buildPackageJsonWorkspacesMatcher(
  workspaceRoot: string,
  readJson: (string) => any
) {
  const patterns = getGlobPatternsFromPackageManagerWorkspaces(
    workspaceRoot,
    readJson
  );

  const negativePatterns = patterns.filter((p) => p.startsWith('!'));
  const positivePatterns = patterns.filter((p) => !p.startsWith('!'));

  if (
    // There are some negative patterns
    negativePatterns.length > 0 &&
    // No positive patterns
    (positivePatterns.length === 0 ||
      // Or only a single positive pattern that is the default coming from root package
      (positivePatterns.length === 1 && positivePatterns[0] === 'package.json'))
  ) {
    positivePatterns.push('**/package.json');
  }

  return (p: string) =>
    positivePatterns.some((positive) => minimatch(p, positive)) &&
    /**
     * minimatch will return true if the given p is NOT excluded by the negative pattern.
     *
     * For example if the negative pattern is "!packages/vite", then the given p "packages/vite" will return false,
     * the given p "packages/something-else/package.json" will return true.
     *
     * Therefore, we need to ensure that every negative pattern returns true to validate that the given p is not
     * excluded by any of the negative patterns.
     */
    negativePatterns.every((negative) => minimatch(p, negative));
}

export function createNodeFromPackageJson(
  pkgJsonPath: string,
  workspaceRoot: string
) {
  const json: PackageJson = readJsonFile(join(workspaceRoot, pkgJsonPath));
  const project = buildProjectConfigurationFromPackageJson(
    json,
    workspaceRoot,
    pkgJsonPath,
    readNxJson(workspaceRoot)
  );
  return {
    projects: {
      [project.root]: project,
    },
  };
}

export function buildProjectConfigurationFromPackageJson(
  packageJson: PackageJson,
  workspaceRoot: string,
  packageJsonPath: string,
  nxJson: NxJsonConfiguration
): ProjectConfiguration & { name: string } {
  const normalizedPath = packageJsonPath.split('\\').join('/');
  const projectRoot = dirname(normalizedPath);

  const siblingProjectJson = tryReadJson<ProjectConfiguration>(
    join(workspaceRoot, projectRoot, 'project.json')
  );

  if (siblingProjectJson) {
    for (const target of Object.keys(siblingProjectJson?.targets ?? {})) {
      delete packageJson.scripts?.[target];
    }
  }

  if (!packageJson.name && projectRoot === '.') {
    throw new Error(
      'Nx requires the root package.json to specify a name if it is being used as an Nx project.'
    );
  }

  let name = packageJson.name ?? toProjectName(normalizedPath);

  const projectConfiguration: ProjectConfiguration & { name: string } = {
    root: projectRoot,
    sourceRoot: projectRoot,
    name,
    ...packageJson.nx,
    targets: readTargetsFromPackageJson(packageJson),
    tags: getTagsFromPackageJson(packageJson),
    metadata: getMetadataFromPackageJson(packageJson),
  };

  if (
    nxJson?.workspaceLayout?.appsDir != nxJson?.workspaceLayout?.libsDir &&
    nxJson?.workspaceLayout?.appsDir &&
    projectRoot.startsWith(nxJson.workspaceLayout.appsDir)
  ) {
    projectConfiguration.projectType = 'application';
  } else if (
    typeof nxJson?.workspaceLayout?.libsDir !== 'undefined' &&
    projectRoot.startsWith(nxJson.workspaceLayout.libsDir)
  ) {
    projectConfiguration.projectType = 'library';
  }

  return projectConfiguration;
}

/**
 * Get the package.json globs from package manager workspaces
 */
export function getGlobPatternsFromPackageManagerWorkspaces(
  root: string,
  readJson: <T extends Object>(path: string) => T = <T extends Object>(path) =>
    readJsonFile<T>(join(root, path)) // making this an arg allows us to reuse in devkit
): string[] {
  try {
    const patterns: string[] = [];
    const packageJson = readJson<PackageJson>('package.json');

    patterns.push(
      ...normalizePatterns(
        Array.isArray(packageJson.workspaces)
          ? packageJson.workspaces
          : packageJson.workspaces?.packages ?? []
      )
    );

    if (existsSync(join(root, 'pnpm-workspace.yaml'))) {
      try {
        const { packages } = readYamlFile<{ packages: string[] }>(
          join(root, 'pnpm-workspace.yaml')
        );
        patterns.push(...normalizePatterns(packages || []));
      } catch (e: unknown) {
        output.warn({
          title: `${NX_PREFIX} Unable to parse pnpm-workspace.yaml`,
          bodyLines: [e.toString()],
        });
      }
    }

    if (existsSync(join(root, 'lerna.json'))) {
      try {
        const { packages } = readJson<any>('lerna.json');
        patterns.push(
          ...normalizePatterns(packages?.length > 0 ? packages : ['packages/*'])
        );
      } catch (e: unknown) {
        output.warn({
          title: `${NX_PREFIX} Unable to parse lerna.json`,
          bodyLines: [e.toString()],
        });
      }
    }

    // Merge patterns from workspaces definitions
    // TODO(@AgentEnder): update logic after better way to determine root project inclusion
    // Include the root project
    return packageJson.nx ? patterns.concat('package.json') : patterns;
  } catch {
    return [];
  }
}

function normalizePatterns(patterns: string[]): string[] {
  return patterns.map((pattern) =>
    removeRelativePath(
      pattern.endsWith('/package.json')
        ? pattern
        : joinPathFragments(pattern, 'package.json')
    )
  );
}

function removeRelativePath(pattern: string): string {
  return pattern.startsWith('./') ? pattern.substring(2) : pattern;
}

function tryReadJson<T extends Object = any>(path: string): T | null {
  try {
    return readJsonFile<T>(path);
  } catch {
    return null;
  }
}
