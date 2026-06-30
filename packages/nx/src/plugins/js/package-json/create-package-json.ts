import { readJsonFile } from '../../../utils/fileutils';
import { sortObjectByKeys } from '../../../utils/object-sort';
import {
  fileDataDepTarget,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import {
  getDependencyVersionFromPackageJson,
  PackageJson,
} from '../../../utils/package-json';
import { existsSync } from 'fs';
import { workspaceRoot } from '../../../utils/workspace-root';
import { readNxJson } from '../../../config/configuration';
import { readFileMapCache } from '../../../project-graph/nx-deps-cache';
import { join } from 'path';
import {
  filterUsingGlobPatterns,
  getTargetInputs,
} from '../../../hasher/task-hasher';
import { output } from '../../../utils/output';

interface NpmDeps {
  readonly dependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
  readonly peerDependenciesMeta: Record<string, { optional: boolean }>;
}

/**
 * Creates a package.json in the output directory for support to install dependencies within containers.
 *
 * If a package.json exists in the project, it will reuse that.
 * If isProduction flag is set, it wil  remove devDependencies and optional peerDependencies
 */
export function createPackageJson(
  projectName: string,
  graph: ProjectGraph,
  options: {
    target?: string;
    root?: string;
    isProduction?: boolean;
    helperDependencies?: string[];
    skipPackageManager?: boolean;
    skipOverrides?: boolean;
    /**
     * Set when a pruned pnpm lockfile is emitted alongside this package.json.
     * The lockfile bakes overrides, ignoredOptionalDependencies, and
     * packageExtensions into its resolved snapshots and checksums, so they are
     * dropped from the manifest to avoid ERR_PNPM_LOCKFILE_CONFIG_MISMATCH on
     * pnpm <=10. Leave unset when only a package.json is generated, so a fresh
     * install still resolves with them.
     */
    prunedLockfile?: boolean;
  } = {},
  fileMap: ProjectFileMap = null
): PackageJson {
  const projectNode = graph.nodes[projectName];
  const isLibrary = projectNode.type === 'lib';
  const root = options.root ?? workspaceRoot;

  const rootPackageJson: PackageJson = readJsonFile(join(root, 'package.json'));

  const npmDeps = findProjectsNpmDependencies(
    projectNode,
    graph,
    options.target,
    rootPackageJson,
    {
      helperDependencies: options.helperDependencies,
      isProduction: options.isProduction,
    },
    fileMap
  );

  // default package.json if one does not exist
  let packageJson: PackageJson = {
    name: projectName,
    version: '0.0.1',
  };
  const projectPackageJsonPath = join(
    root,
    projectNode.data.root,
    'package.json'
  );
  if (existsSync(projectPackageJsonPath)) {
    try {
      packageJson = readJsonFile(projectPackageJsonPath);
      // for standalone projects we don't want to include all the root dependencies
      if (graph.nodes[projectName].data.root === '.') {
        // TODO: We should probably think more on this - Nx can't always
        // detect all external dependencies, and there's not a way currently
        // to tell Nx that we need one of these deps. For non-standalone projects
        // we tell people to add it to the package.json of the project, and we
        // merge it. For standalone, this pattern doesn't work because of this piece of code.
        // It breaks expectations, but also, I don't know another way around it currently.
        // If Nx doesn't pick up a dep, say some css lib that is only imported in a .scss file,
        // we need to be able to tell it to keep that dep in the generated package.json.
        delete packageJson.dependencies;
        delete packageJson.devDependencies;
      }
      if (options.isProduction) {
        delete packageJson.devDependencies;
      }
    } catch (e) {}
  }

  const getVersion = (
    packageName: string,
    version: string,
    section: 'devDependencies' | 'dependencies'
  ) => {
    // Try project package.json first (single section)
    const projectVersion = getDependencyVersionFromPackageJson(
      packageName,
      root,
      packageJson,
      [section]
    );
    if (projectVersion) {
      return projectVersion;
    }

    // For libraries, fall back to root package.json (single section)
    if (isLibrary) {
      const rootVersion = getDependencyVersionFromPackageJson(
        packageName,
        root,
        rootPackageJson,
        [section]
      );
      if (rootVersion) {
        return rootVersion;
      }
    }

    return version;
  };

  Object.entries(npmDeps.dependencies).forEach(([packageName, version]) => {
    if (
      rootPackageJson.devDependencies?.[packageName] &&
      !packageJson.dependencies?.[packageName] &&
      !packageJson.peerDependencies?.[packageName]
    ) {
      // don't store dev dependencies for production
      if (!options.isProduction) {
        packageJson.devDependencies ??= {};
        packageJson.devDependencies[packageName] = getVersion(
          packageName,
          version,
          'devDependencies'
        );
      }
    } else {
      if (!packageJson.peerDependencies?.[packageName]) {
        packageJson.dependencies ??= {};
        packageJson.dependencies[packageName] = getVersion(
          packageName,
          version,
          'dependencies'
        );
      }
    }
  });
  if (!isLibrary) {
    Object.entries(npmDeps.peerDependencies).forEach(
      ([packageName, version]) => {
        if (!packageJson.peerDependencies?.[packageName]) {
          if (rootPackageJson.dependencies?.[packageName]) {
            packageJson.dependencies ??= {};
            packageJson.dependencies[packageName] = getVersion(
              packageName,
              version,
              'dependencies'
            );
            return;
          }

          const isOptionalPeer =
            npmDeps.peerDependenciesMeta[packageName]?.optional;
          if (!isOptionalPeer) {
            if (
              !options.isProduction ||
              rootPackageJson.dependencies?.[packageName]
            ) {
              packageJson.peerDependencies ??= {};
              packageJson.peerDependencies[packageName] = getVersion(
                packageName,
                version,
                'dependencies'
              );
            }
          } else if (!options.isProduction) {
            // add peer optional dependencies if not in production
            packageJson.peerDependencies ??= {};
            packageJson.peerDependencies[packageName] = version;
            packageJson.peerDependenciesMeta ??= {};
            packageJson.peerDependenciesMeta[packageName] = {
              optional: true,
            };
          }
        }
      }
    );
  }

  packageJson.devDependencies &&= sortObjectByKeys(packageJson.devDependencies);
  packageJson.dependencies &&= sortObjectByKeys(packageJson.dependencies);
  packageJson.peerDependencies &&= sortObjectByKeys(
    packageJson.peerDependencies
  );
  packageJson.peerDependenciesMeta &&= sortObjectByKeys(
    packageJson.peerDependenciesMeta
  );

  if (rootPackageJson.packageManager && !options.skipPackageManager) {
    if (
      packageJson.packageManager &&
      packageJson.packageManager !== rootPackageJson.packageManager
    ) {
      output.warn({
        title: 'Package Manager Mismatch',
        bodyLines: [
          `The project ${projectName} has explicitly specified "packageManager" config of "${packageJson.packageManager}" but the workspace is using "${rootPackageJson.packageManager}".`,
          `Please remove the project level "packageManager" config or align it with the workspace root package.json.`,
        ],
      });
    }
    packageJson.packageManager = rootPackageJson.packageManager;
  }

  // region Overrides/Resolutions

  // npm
  if (rootPackageJson.overrides && !options.skipOverrides) {
    // npm throws EOVERRIDE when an override key is also a direct dependency
    // (unless specs match). The pruned dist pins exact versions and already
    // resolved everything via the lockfile, so drop those redundant overrides.
    const mergedOverrides = {
      ...rootPackageJson.overrides,
      ...packageJson.overrides,
    };
    const overrides: typeof mergedOverrides = {};
    let hasOverrides = false;
    for (const name in mergedOverrides) {
      if (
        packageJson.dependencies?.[name] ||
        packageJson.devDependencies?.[name] ||
        packageJson.peerDependencies?.[name] ||
        packageJson.optionalDependencies?.[name]
      ) {
        continue;
      }
      overrides[name] = mergedOverrides[name];
      hasOverrides = true;
    }
    if (hasOverrides) {
      packageJson.overrides = overrides;
    } else {
      delete packageJson.overrides;
    }
  }

  // pnpm
  if (rootPackageJson.pnpm?.overrides && !options.skipOverrides) {
    packageJson.pnpm ??= {};
    packageJson.pnpm.overrides = {
      ...rootPackageJson.pnpm.overrides,
      ...packageJson.pnpm.overrides,
    };
  }

  // pnpm install configuration
  const rootPnpm = rootPackageJson.pnpm;
  if (rootPnpm) {
    // string[] fields — copy from root
    for (const field of [
      'onlyBuiltDependencies',
      'neverBuiltDependencies',
      'ignoredOptionalDependencies',
    ] as const) {
      if (rootPnpm[field]) {
        packageJson.pnpm ??= {};
        packageJson.pnpm[field] = rootPnpm[field];
      }
    }

    // object fields — merge with project-level overrides
    if (rootPnpm.allowBuilds) {
      packageJson.pnpm ??= {};
      packageJson.pnpm.allowBuilds = {
        ...rootPnpm.allowBuilds,
        ...packageJson.pnpm.allowBuilds,
      };
    }
    if (rootPnpm.supportedArchitectures) {
      packageJson.pnpm ??= {};
      packageJson.pnpm.supportedArchitectures = {
        ...rootPnpm.supportedArchitectures,
        ...packageJson.pnpm.supportedArchitectures,
      };
    }
  }

  // yarn
  if (rootPackageJson.resolutions && !options.skipOverrides) {
    packageJson.resolutions = {
      ...rootPackageJson.resolutions,
      ...packageJson.resolutions,
    };
  }
  // endregion Overrides/Resolutions

  // When a pruned pnpm lockfile ships alongside, the manifest must not re-declare
  // pnpm config the lockfile already baked into its snapshots and checksums, or
  // pnpm <=10 aborts with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH (pnpm 11 ignores the
  // package.json `pnpm` field anyway).
  if (options.prunedLockfile) {
    stripPrunedLockfilePnpmConfig(packageJson);
  }

  return packageJson;
}

/**
 * Drop the pnpm config fields (`overrides`, `ignoredOptionalDependencies`,
 * `packageExtensions`) a pruned standalone lockfile already resolves into its
 * snapshots, then drop an emptied `pnpm` block. Re-declaring them next to a
 * pruned lockfile makes pnpm <=10 fail with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
 * Shared by every prune path that ships a manifest beside a generated lockfile.
 */
export function stripPrunedLockfilePnpmConfig(packageJson: PackageJson): void {
  if (!packageJson.pnpm) {
    return;
  }
  delete packageJson.pnpm.overrides;
  delete packageJson.pnpm.ignoredOptionalDependencies;
  delete packageJson.pnpm.packageExtensions;
  if (Object.keys(packageJson.pnpm).length === 0) {
    delete packageJson.pnpm;
  }
}

export function findProjectsNpmDependencies(
  projectNode: ProjectGraphProjectNode,
  graph: ProjectGraph,
  target: string,
  rootPackageJson: PackageJson,
  options: {
    helperDependencies?: string[];
    ignoredDependencies?: string[];
    isProduction?: boolean;
  },
  fileMap?: ProjectFileMap
): NpmDeps {
  if (fileMap == null) {
    fileMap = readFileMapCache()?.fileMap?.projectFileMap || {};
  }

  const { selfInputs, dependencyInputs } = target
    ? getTargetInputs(readNxJson(), projectNode, target)
    : { selfInputs: [], dependencyInputs: [] };

  const npmDeps: NpmDeps = {
    dependencies: {},
    peerDependencies: {},
    peerDependenciesMeta: {},
  };

  const seen = new Set<string>();

  options.helperDependencies?.forEach((dep) => {
    seen.add(dep);
    npmDeps.dependencies[graph.externalNodes[dep].data.packageName] =
      graph.externalNodes[dep].data.version;
    recursivelyCollectPeerDependencies(dep, graph, npmDeps, seen);
  });

  // if it's production, we want to ignore all found devDependencies
  const ignoredDependencies =
    options.isProduction && rootPackageJson.devDependencies
      ? [
          ...(options.ignoredDependencies || []),
          ...Object.keys(rootPackageJson.devDependencies),
        ]
      : options.ignoredDependencies || [];

  findAllNpmDeps(
    fileMap,
    projectNode,
    graph,
    npmDeps,
    seen,
    ignoredDependencies,
    dependencyInputs,
    selfInputs,
    false
  );

  return npmDeps;
}

function findAllNpmDeps(
  projectFileMap: ProjectFileMap,
  projectNode: ProjectGraphProjectNode,
  graph: ProjectGraph,
  npmDeps: NpmDeps,
  seen: Set<string>,
  ignoredDependencies: string[],
  dependencyPatterns: string[],
  rootPatterns?: string[],
  isTransitiveDependency = false
): void {
  if (seen.has(projectNode.name)) return;

  seen.add(projectNode.name);

  const projectFiles = filterUsingGlobPatterns(
    projectNode.data.root,
    projectFileMap[projectNode.name] || [],
    isTransitiveDependency
      ? ['{projectRoot}/**/*']
      : (rootPatterns ?? dependencyPatterns)
  );

  const projectDependencies = new Set<string>();

  projectFiles.forEach((fileData) =>
    fileData.deps?.forEach((dep) =>
      projectDependencies.add(fileDataDepTarget(dep))
    )
  );

  for (const dep of projectDependencies) {
    const node = graph.externalNodes[dep];

    if (seen.has(dep)) {
      // if it's in peerDependencies, move it to regular dependencies
      // since this is a direct dependency of the project
      if (node && npmDeps.peerDependencies[node.data.packageName]) {
        npmDeps.dependencies[node.data.packageName] = node.data.version;
        delete npmDeps.peerDependencies[node.data.packageName];
      }
    } else {
      if (node) {
        seen.add(dep);
        // do not add ignored dependencies to the list or non-npm dependencies
        if (
          ignoredDependencies.includes(node.data.packageName) ||
          node.type !== 'npm'
        ) {
          continue;
        }

        npmDeps.dependencies[node.data.packageName] = node.data.version;
        recursivelyCollectPeerDependencies(node.name, graph, npmDeps, seen);
      } else if (graph.nodes[dep]) {
        findAllNpmDeps(
          projectFileMap,
          graph.nodes[dep],
          graph,
          npmDeps,
          seen,
          ignoredDependencies,
          dependencyPatterns,
          undefined,
          true
        );
      }
    }
  }
}

function recursivelyCollectPeerDependencies(
  projectName: string,
  graph: ProjectGraph,
  npmDeps: NpmDeps,
  seen: Set<string>
) {
  const npmPackage = graph.externalNodes[projectName];
  if (!npmPackage) {
    return npmDeps;
  }

  const packageName = npmPackage.data.packageName;
  try {
    const packageJson = require(`${packageName}/package.json`);
    if (!packageJson.peerDependencies) {
      return npmDeps;
    }

    Object.keys(packageJson.peerDependencies)
      .map((dependencyName) => `npm:${dependencyName}`)
      .map((dependency) => graph.externalNodes[dependency])
      .filter(Boolean)
      .forEach((node) => {
        if (!seen.has(node.name)) {
          seen.add(node.name);
          npmDeps.peerDependencies[node.data.packageName] = node.data.version;
          if (
            packageJson.peerDependenciesMeta &&
            packageJson.peerDependenciesMeta[node.data.packageName] &&
            packageJson.peerDependenciesMeta[node.data.packageName].optional
          ) {
            npmDeps.peerDependenciesMeta[node.data.packageName] = {
              optional: true,
            };
          }
          recursivelyCollectPeerDependencies(node.name, graph, npmDeps, seen);
        }
      });
    return npmDeps;
  } catch (e) {
    return npmDeps;
  }
}
