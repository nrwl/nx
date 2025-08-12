import { minimatch } from 'minimatch';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
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
import {
  createNodesFromFiles,
  CreateNodesV2,
} from '../../project-graph/plugins';
import { basename } from 'path';
import { hashObject } from '../../hasher/file-hasher';
import {
  PackageJsonConfigurationCache,
  readPackageJsonConfigurationCache,
} from '../../../plugins/package-json';

export const createNodesV2: CreateNodesV2 = [
  combineGlobPatterns(
    'package.json',
    '**/package.json',
    'project.json',
    '**/project.json'
  ),
  (configFiles, _, context) => {
    const { packageJsons, projectJsonRoots } = splitConfigFiles(configFiles);

    const readJson = (f) => readJsonFile(join(context.workspaceRoot, f));
    const isInPackageJsonWorkspaces =
      process.env.NX_INFER_ALL_PACKAGE_JSONS === 'true' &&
      !configFiles.includes('package.json')
        ? () => true
        : buildPackageJsonWorkspacesMatcher(context.workspaceRoot, readJson);
    const isNextToProjectJson = (packageJsonPath: string) => {
      return projectJsonRoots.has(dirname(packageJsonPath));
    };

    const cache = readPackageJsonConfigurationCache();

    return createNodesFromFiles(
      (packageJsonPath, options, context) => {
        const isInPackageManagerWorkspaces =
          isInPackageJsonWorkspaces(packageJsonPath);
        if (
          !isInPackageManagerWorkspaces &&
          !isNextToProjectJson(packageJsonPath)
        ) {
          // Skip if package.json is not part of the package.json workspaces and not next to a project.json.
          return null;
        }

        return createNodeFromPackageJson(
          packageJsonPath,
          context.workspaceRoot,
          cache,
          isInPackageManagerWorkspaces
        );
      },
      packageJsons,
      _,
      context
    );
  },
];

function splitConfigFiles(configFiles: readonly string[]): {
  packageJsons: string[];
  projectJsonRoots: Set<string>;
} {
  const packageJsons = [];
  const projectJsonRoots = new Set<string>();

  for (const configFile of configFiles) {
    if (basename(configFile) === 'package.json') {
      packageJsons.push(configFile);
    } else {
      projectJsonRoots.add(dirname(configFile));
    }
  }

  return { packageJsons, projectJsonRoots };
}

export function buildPackageJsonWorkspacesMatcher(
  workspaceRoot: string,
  readJson: (path: string) => any
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
  workspaceRoot: string,
  cache: PackageJsonConfigurationCache,
  isInPackageManagerWorkspaces: boolean
) {
  const json: PackageJson = readJsonFile(join(workspaceRoot, pkgJsonPath));

  const projectRoot = dirname(pkgJsonPath);

  const hash = hashObject({
    ...json,
    root: projectRoot,
    isInPackageManagerWorkspaces,
    // change this to bust the cache when making changes that result in different
    // results for the same hash
    bust: 1,
  });

  const cached = cache[hash];
  if (cached) {
    return {
      projects: {
        [cached.root]: cached,
      },
    };
  }

  const project = buildProjectConfigurationFromPackageJson(
    json,
    workspaceRoot,
    pkgJsonPath,
    readNxJson(workspaceRoot),
    isInPackageManagerWorkspaces
  );

  cache[hash] = project;
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
  nxJson: NxJsonConfiguration,
  isInPackageManagerWorkspaces: boolean
): ProjectConfiguration & { name: string } {
  const normalizedPath = packageJsonPath.split('\\').join('/');
  const projectRoot = dirname(normalizedPath);

  const siblingProjectJson = tryReadJson<ProjectConfiguration>(
    join(workspaceRoot, projectRoot, 'project.json')
  );

  if (siblingProjectJson) {
    for (const target of Object.keys(siblingProjectJson?.targets ?? {})) {
      const { executor, command, options } = siblingProjectJson.targets[target];
      if (
        // will use run-commands, different target
        command ||
        // Either uses a different executor or runs a different script
        (executor &&
          (executor !== 'nx:run-script' || options?.script !== target))
      ) {
        delete packageJson.scripts?.[target];
      }
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
    name,
    ...packageJson.nx,
    targets: readTargetsFromPackageJson(
      packageJson,
      nxJson,
      projectRoot,
      workspaceRoot
    ),
    tags: getTagsFromPackageJson(packageJson),
    metadata: getMetadataFromPackageJson(
      packageJson,
      isInPackageManagerWorkspaces
    ),
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
  // allow overwriting these args so we can use them in devkit
  readJson: <T extends Object>(path: string) => T = <T extends Object>(
    path: string
  ) => readJsonFile<T>(join(root, path)),
  readYaml: <T extends Object>(path: string) => T = <T extends Object>(
    path: string
  ) => readYamlFile<T>(join(root, path)),
  exists: (path: string) => boolean = (p) => existsSync(join(root, p))
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

    if (exists('pnpm-workspace.yaml')) {
      try {
        const { packages } =
          readYaml<{ packages: string[] }>('pnpm-workspace.yaml') ?? {};
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
        const { packages } = readJson<any>('lerna.json') ?? {};
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
