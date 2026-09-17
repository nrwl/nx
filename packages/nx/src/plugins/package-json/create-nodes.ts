import { Minimatch } from 'minimatch';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { NxJsonConfiguration } from '../../config/nx-json';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { toProjectName } from '../../config/to-project-name';
import { hashObject } from '../../hasher/file-hasher';
import { createNodesFromFiles, CreateNodes } from '../../project-graph/plugins';
import { readTargetDefaultsForTarget } from '../../project-graph/utils/project-configuration-utils';
import { readJsonFile, readYamlFile } from '../../utils/fileutils';
import { combineGlobPatterns } from '../../utils/globs';
import { hasNxJsPlugin } from '../../utils/has-nx-js-plugin';
import { NX_PREFIX } from '../../utils/logger';
import { output } from '../../utils/output';
import {
  getMetadataFromPackageJson,
  PackageJson,
  getTagsFromPackageJson,
  readTargetsFromPackageJson,
} from '../../utils/package-json';
import {
  detectPackageManager,
  getPackageManagerCommand,
  PackageManagerCommands,
} from '../../utils/package-manager';
import { joinPathFragments } from '../../utils/path';
import { nxVersion } from '../../utils/versions';
import { getFileHashesInContext } from '../../utils/workspace-context';
import {
  PackageJsonConfigurationCache,
  readPackageJsonConfigurationCache,
} from './cache';

const globPatterns = combineGlobPatterns(
  'package.json',
  '**/package.json',
  'project.json',
  '**/project.json'
);

export const createNodes: CreateNodes = [
  globPatterns,
  async (configFiles, _, context) => {
    const { packageJsons, projectJsonRoots } = splitConfigFiles(configFiles);

    const readJson = (f) => readJsonFile(join(context.workspaceRoot, f));
    let isInPackageJsonWorkspaces = (p: string) => true;

    if (
      process.env.NX_INFER_ALL_PACKAGE_JSONS !== 'true' ||
      configFiles.includes('package.json')
    ) {
      const patterns = buildPackageJsonPatterns(
        context.workspaceRoot,
        readJson
      );
      isInPackageJsonWorkspaces = buildPackageJsonWorkspacesMatcher(patterns);
    }
    const isNextToProjectJson = (packageJsonPath: string) => {
      return projectJsonRoots.has(dirname(packageJsonPath));
    };
    const packageManagerWorkspaceMembership: boolean[] = [];
    const includedPackageJsons = packageJsons.filter((path) => {
      const isInWorkspace = isInPackageJsonWorkspaces(path);
      if (isInWorkspace || isNextToProjectJson(path)) {
        packageManagerWorkspaceMembership.push(isInWorkspace);
        return true;
      }
      return false;
    });

    const cache = readPackageJsonConfigurationCache();

    const packageManagerCommand = getPackageManagerCommand(
      detectPackageManager(context.workspaceRoot),
      context.workspaceRoot
    );
    const sharedInputs = createSharedPackageJsonInputs(
      context.nxJsonConfiguration,
      packageManagerCommand
    );
    const configurationHashes = await getPackageJsonConfigurationHashes(
      context.workspaceRoot,
      includedPackageJsons
    );

    const result = await createNodesFromFiles(
      (packageJsonPath, options, context, index) => {
        return createNodeFromPackageJson(
          packageJsonPath,
          context.workspaceRoot,
          cache,
          packageManagerWorkspaceMembership[index],
          sharedInputs,
          configurationHashes[index]
        );
      },
      includedPackageJsons,
      _,
      context
    );

    cache.writeToDiskIfChanged();
    return result;
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
export function buildPackageJsonPatterns(
  workspaceRoot: string,
  readJson: (path: string) => any
): PackageJsonPatterns {
  const patterns = getGlobPatternsFromPackageManagerWorkspaces(
    workspaceRoot,
    readJson
  );

  const negativePatterns: string[] = [];
  const positivePatterns: string[] = [];
  const positivePatternLookup: Record<string, boolean> = {};
  const negativePatternLookup: Record<string, boolean> = {};

  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      negativePatterns.push(pattern);
      negativePatternLookup[pattern.slice(1)] = true;
    } else {
      positivePatterns.push(pattern);
      positivePatternLookup[pattern] = true;
    }
  }
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

  return {
    positive: positivePatterns,
    positiveLookup: positivePatternLookup,
    negative: negativePatterns,
    negativeLookup: negativePatternLookup,
  };
}
type PackageJsonPatterns = {
  positive: string[];
  positiveLookup: Record<string, boolean>;
  negative: string[];
  negativeLookup: Record<string, boolean>;
};
export function buildPackageJsonWorkspacesMatcher(
  patterns: PackageJsonPatterns
) {
  // Compile each glob once; the returned matcher runs per package.json path.
  const positive = patterns.positive.map((p) => new Minimatch(p));
  const negative = patterns.negative.map((p) => new Minimatch(p));
  return (p) =>
    // use lookup to avoid unnecessary minimatch calls
    (patterns.positiveLookup[p] || positive.some((m) => m.match(p))) &&
    /**
     * minimatch will return true if the given p is NOT excluded by the negative pattern.
     *
     * For example if the negative pattern is "!packages/vite", then the given p "packages/vite" will return false,
     * the given p "packages/something-else/package.json" will return true.
     *
     * Therefore, we need to ensure that every negative pattern returns true to validate that the given p is not
     * excluded by any of the negative patterns.
     */
    !patterns.negativeLookup[p] &&
    negative.every((m) => m.match(p));
}

export function createNodeFromPackageJson(
  pkgJsonPath: string,
  workspaceRoot: string,
  cache: PackageJsonConfigurationCache,
  isInPackageManagerWorkspaces: boolean,
  sharedInputs: SharedPackageJsonInputs,
  configurationHashes?: PackageJsonConfigurationHashes
) {
  const projectRoot = dirname(pkgJsonPath);
  let hasNxJsPluginInstalled: boolean | undefined;
  const resolveNxJsPlugin = () =>
    (hasNxJsPluginInstalled ??= hasNxJsPlugin(projectRoot, workspaceRoot));
  let json: PackageJson;
  let siblingProjectJson: ProjectConfiguration | null | undefined;

  let configurationInputs: object;
  if (configurationHashes) {
    configurationInputs = configurationHashes;
    if (configurationHashes.siblingProjectJsonHash === null) {
      // Ignored files are absent from the index but still affect script inference.
      siblingProjectJson = tryReadJson(
        join(workspaceRoot, projectRoot, 'project.json')
      );
      configurationInputs = { ...configurationHashes, siblingProjectJson };
    }
  } else {
    json = readJsonFile(join(workspaceRoot, pkgJsonPath));
    siblingProjectJson = tryReadJson(
      join(workspaceRoot, projectRoot, 'project.json')
    );
    configurationInputs = {
      packageJson: json,
      siblingProjectJson,
    };
  }

  const hash = hashObject({
    ...configurationInputs,
    root: projectRoot,
    isInPackageManagerWorkspaces,
    sharedInputHash: sharedInputs.hash,
  });

  const cached = cache.get(hash);
  if (
    cached &&
    (cached.hasNxJsPlugin === undefined ||
      cached.hasNxJsPlugin === resolveNxJsPlugin()) &&
    (!cached.hasNxJsPlugin ||
      cached.releaseTargetDefaultsHash ===
        sharedInputs.releaseTargetDefaultsHash)
  ) {
    return {
      projects: {
        [cached.project.root]: cached.project,
      },
    };
  }

  json ??= readJsonFile(join(workspaceRoot, pkgJsonPath));
  if (siblingProjectJson === undefined) {
    siblingProjectJson = tryReadJson(
      join(workspaceRoot, projectRoot, 'project.json')
    );
  }

  const project = buildProjectConfigurationFromPackageJson(
    json,
    workspaceRoot,
    pkgJsonPath,
    sharedInputs.nxJson,
    isInPackageManagerWorkspaces,
    sharedInputs.packageManagerCommand,
    siblingProjectJson,
    resolveNxJsPlugin
  );

  cache.set(hash, {
    project,
    hasNxJsPlugin: hasNxJsPluginInstalled,
    releaseTargetDefaultsHash: hasNxJsPluginInstalled
      ? sharedInputs.releaseTargetDefaultsHash
      : undefined,
  });
  return {
    projects: {
      [project.root]: project,
    },
  };
}

export async function getPackageJsonConfigurationHashes(
  workspaceRoot: string,
  packageJsonPaths: readonly string[]
): Promise<Array<PackageJsonConfigurationHashes | undefined>> {
  if (packageJsonPaths.length === 0) {
    return [];
  }
  const wantedPaths: string[] = [];
  for (const packageJsonPath of packageJsonPaths) {
    wantedPaths.push(
      packageJsonPath,
      joinPathFragments(dirname(packageJsonPath), 'project.json')
    );
  }

  const fileHashes = await getFileHashesInContext(workspaceRoot, wantedPaths);

  return packageJsonPaths.map((_, index) => {
    const packageJsonHash = fileHashes[index * 2];
    if (!packageJsonHash) {
      return undefined;
    }

    return {
      packageJsonHash,
      siblingProjectJsonHash: fileHashes[index * 2 + 1] ?? null,
    };
  });
}

export type PackageJsonConfigurationHashes = {
  packageJsonHash: string;
  siblingProjectJsonHash: string | null;
};

export type SharedPackageJsonInputs = {
  hash: string;
  releaseTargetDefaultsHash: string;
  nxJson: NxJsonConfiguration;
  packageManagerCommand: PackageManagerCommands;
};

export function createSharedPackageJsonInputs(
  nxJson: NxJsonConfiguration,
  packageManagerCommand: PackageManagerCommands
): SharedPackageJsonInputs {
  return {
    hash: hashObject({
      nxJson: {
        workspaceLayout: nxJson.workspaceLayout,
      },
      nxVersion,
      cacheVersion: 2,
      packageManagerRunCommand: packageManagerCommand.run('{script}'),
    }),
    releaseTargetDefaultsHash: hashObject({
      defaults: readTargetDefaultsForTarget(
        'nx-release-publish',
        nxJson.targetDefaults,
        '@nx/js:release-publish'
      ),
    }),
    nxJson,
    packageManagerCommand,
  };
}

export function buildProjectConfigurationFromPackageJson(
  packageJson: PackageJson,
  workspaceRoot: string,
  packageJsonPath: string,
  nxJson: NxJsonConfiguration,
  isInPackageManagerWorkspaces: boolean,
  packageManagerCommand: PackageManagerCommands,
  siblingProjectJson: ProjectConfiguration | null = tryReadJson(
    join(workspaceRoot, dirname(packageJsonPath), 'project.json')
  ),
  resolveNxJsPlugin?: () => boolean
): ProjectConfiguration & { name: string } {
  const normalizedPath = packageJsonPath.split('\\').join('/');
  const projectRoot = dirname(normalizedPath);

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

  if (!packageJson.name && projectRoot === '.' && !packageJson.nx?.name) {
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
      workspaceRoot,
      packageManagerCommand,
      resolveNxJsPlugin
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
          : (packageJson.workspaces?.packages ?? [])
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
