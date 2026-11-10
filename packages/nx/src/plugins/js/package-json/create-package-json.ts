import { readJsonFile } from '../../../utils/fileutils';
import { sortObjectByKeys } from '../../../utils/object-sort';
import {
  fileDataDepTarget,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import {
  getDependencyVersionFromPackageJson,
  isTarballPath,
  PackageJson,
  readModulePackageJson,
} from '../../../utils/package-json';
import { existsSync, realpathSync } from 'fs';
import { workspaceRoot } from '../../../utils/workspace-root';
import { readNxJson } from '../../../config/configuration';
import { readFileMapCache } from '../../../project-graph/nx-deps-cache';
import { isAbsolute, join, posix } from 'path';
import {
  filterUsingGlobPatterns,
  getTargetInputs,
} from '../../../hasher/task-hasher';
import { output } from '../../../utils/output';
import { detectPackageManager } from '../../../utils/package-manager';
import { normalizePath } from '../../../utils/path';
import {
  findNodeMatchingVersion,
  isLinkNode,
  isLocalPathSpecifier,
} from '../lock-file/project-graph-pruning';
import { logger } from '../../../utils/logger';

interface NpmDeps {
  readonly dependencies: Record<string, string>;
  readonly peerDependencies: Record<string, string>;
  readonly peerDependenciesMeta: Record<string, { optional: boolean }>;
  // The project whose files import each dependency, by package name
  readonly importingProjects: Record<string, string>;
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
    fileMap,
    root
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

  const getInheritedLocalPathSpec = createInheritedLocalPathSpecResolver(
    projectNode,
    graph,
    root,
    rootPackageJson
  );

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

    // A local package's graph version, or the version its `npm:` alias names,
    // is a `file:`/`link:` version or a Bun tarball's path, which can parse as
    // semver (`1.0.0-rc.tgz`)
    const recordedVersion = getAliasedVersion(version);
    if (
      isLocalPathSpecifier(recordedVersion) ||
      isTarballPath(recordedVersion)
    ) {
      const localPathSpec = getInheritedLocalPathSpec(
        packageName,
        version,
        npmDeps.importingProjects[packageName] ?? projectName
      );
      if (localPathSpec) {
        return localPathSpec;
      }
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

  return packageJson;
}

/**
 * A local-path spec for a dependency the project inherits, rebased from its
 * declarer to the project root, where the pnpm and Bun deploy outputs relocate
 * local-path specs from. Declarers are searched in the order the import
 * resolves: for pnpm from the importing project through the projects enclosing
 * it to the root, and for Bun from the root, whose copy of a tarball Bun
 * installs for every workspace declaring the same spec. A declarer counts only
 * when its spec resolves to the path the graph version records. pnpm keeps only
 * the first importer's link per name, so a `link:` on the chain also counts when
 * its node_modules links that target.
 */
function createInheritedLocalPathSpecResolver(
  projectNode: ProjectGraphProjectNode,
  graph: ProjectGraph,
  root: string,
  rootPackageJson: PackageJson
): (
  packageName: string,
  version: string,
  importingProject: string
) => string | undefined {
  const rootDeclarer: LocalPathSpecDeclarer = {
    root: '',
    manifest: rootPackageJson,
  };
  const projectDeclarers = new Map<string, LocalPathSpecDeclarer | null>();
  const getProjectDeclarer = (projectName: string) => {
    if (!projectDeclarers.has(projectName)) {
      projectDeclarers.set(
        projectName,
        readLocalPathSpecDeclarer(graph.nodes[projectName], root)
      );
    }
    return projectDeclarers.get(projectName);
  };
  const declarersByImporter = new Map<
    string,
    { ordered: LocalPathSpecDeclarer[]; onChain: Set<LocalPathSpecDeclarer> }
  >();
  let lookup:
    | { packageManager: 'pnpm' | 'bun'; reachableProjects: string[] }
    | null
    | undefined;
  return (packageName, version, importingProject) => {
    if (lookup === undefined) {
      const packageManager = detectPackageManager(root);
      lookup =
        packageManager === 'pnpm' || packageManager === 'bun'
          ? {
              packageManager,
              reachableProjects: getReachableProjects(projectNode, graph),
            }
          : null;
    }
    if (lookup === null) {
      return undefined;
    }
    if (!declarersByImporter.has(importingProject)) {
      const chain = getImportResolutionChain(graph, importingProject);
      const others = lookup.reachableProjects.filter(
        (projectName) => !chain.includes(projectName)
      );
      const chainDeclarers = chain.map(getProjectDeclarer).filter(Boolean);
      const otherDeclarers = others.map(getProjectDeclarer).filter(Boolean);
      declarersByImporter.set(importingProject, {
        ordered:
          lookup.packageManager === 'bun'
            ? [rootDeclarer, ...chainDeclarers, ...otherDeclarers]
            : [...chainDeclarers, rootDeclarer, ...otherDeclarers],
        onChain: new Set(chainDeclarers),
      });
    }
    const { ordered, onChain } = declarersByImporter.get(importingProject);
    const isPnpmLink =
      lookup.packageManager === 'pnpm' && version.startsWith('link:');
    for (const declarer of ordered) {
      const spec = getDependencyVersionFromPackageJson(
        packageName,
        root,
        declarer.manifest,
        [
          'dependencies',
          'optionalDependencies',
          'devDependencies',
          'peerDependencies',
        ]
      );
      if (!spec || !isLocalPathSpecifier(spec)) {
        continue;
      }
      const protocol = spec.startsWith('link:') ? 'link:' : 'file:';
      const path = normalizePath(spec.slice(protocol.length));
      const target = withoutTrailingSlash(
        isAbsolute(path) ? path : posix.join(declarer.root, path)
      );
      const isChainLink =
        isPnpmLink &&
        protocol === 'link:' &&
        onChain.has(declarer) &&
        isInstalledLinkTarget(root, declarer.root, packageName, target);
      if (
        !isChainLink &&
        getRecordedLocalPath(
          version,
          protocol,
          declarer.root,
          lookup.packageManager
        ) !== target
      ) {
        continue;
      }
      if (isAbsolute(path)) {
        return spec;
      }
      return `${protocol}${posix.relative(projectNode.data.root, target)}`;
    }
    return undefined;
  };
}

/**
 * The path a graph version names, read the way the lockfile records a
 * `protocol` spec of the manifest at `declarerRoot`. pnpm records a `file:`
 * path from the workspace root and a `link:` path from the importer. Bun
 * records directories and `link:` paths from the workspace root, and a tarball
 * from its declarer without the `file:` protocol. Both record a dependency
 * named differently from its package as an `npm:<package>@<version>` alias.
 */
function getRecordedLocalPath(
  graphVersion: string,
  protocol: 'file:' | 'link:',
  declarerRoot: string,
  packageManager: 'pnpm' | 'bun'
): string | undefined {
  const version = getAliasedVersion(graphVersion);
  const isBunTarball =
    packageManager === 'bun' &&
    protocol === 'file:' &&
    !isLocalPathSpecifier(version);
  if (!isBunTarball && !version.startsWith(protocol)) {
    return undefined;
  }
  const path = normalizePath(
    isBunTarball ? version : version.slice(protocol.length)
  );
  if (isAbsolute(path)) {
    return withoutTrailingSlash(path);
  }
  const isDeclarerRelative =
    isBunTarball || (protocol === 'link:' && packageManager === 'pnpm');
  return withoutTrailingSlash(
    posix.join(isDeclarerRelative ? declarerRoot : '', path)
  );
}

// An override can make pnpm link a target other than the declared one
function isInstalledLinkTarget(
  root: string,
  declarerRoot: string,
  packageName: string,
  target: string
): boolean {
  try {
    return (
      realpathSync(join(root, declarerRoot, 'node_modules', packageName)) ===
      realpathSync(isAbsolute(target) ? target : join(root, target))
    );
  } catch {
    return false;
  }
}

// The search starts past the package name's first character, the `@` of a
// scoped name, so an `@` in the version's path stays in the version
function getAliasedVersion(version: string): string {
  if (!version.startsWith('npm:')) {
    return version;
  }
  const separator = version.indexOf('@', 'npm:'.length + 1);
  return separator === -1 ? version : version.slice(separator + 1);
}

// posix.join keeps a trailing slash, so `dir/` and `dir` would differ
function withoutTrailingSlash(path: string): string {
  return path.replace(/(?<=.)\/$/, '');
}

interface LocalPathSpecDeclarer {
  root: string;
  manifest: PackageJson;
}

function readLocalPathSpecDeclarer(
  project: ProjectGraphProjectNode,
  root: string
): LocalPathSpecDeclarer | null {
  const manifestPath = join(root, project.data.root, 'package.json');
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    return { root: project.data.root, manifest: readJsonFile(manifestPath) };
  } catch {
    return null;
  }
}

function getImportResolutionChain(
  graph: ProjectGraph,
  projectName: string
): string[] {
  const projectRoot = graph.nodes[projectName].data.root;
  const enclosing = Object.values(graph.nodes)
    .filter(({ data }) => projectRoot.startsWith(`${data.root}/`))
    .sort((a, b) => b.data.root.length - a.data.root.length)
    .map(({ name }) => name);
  return [projectName, ...enclosing];
}

function getReachableProjects(
  projectNode: ProjectGraphProjectNode,
  graph: ProjectGraph
): string[] {
  const reachable = [projectNode.name];
  const seen = new Set(reachable);
  for (let i = 0; i < reachable.length; i++) {
    for (const { target } of graph.dependencies[reachable[i]] ?? []) {
      if (graph.nodes[target] && !seen.has(target)) {
        seen.add(target);
        reachable.push(target);
      }
    }
  }
  return reachable;
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
  fileMap?: ProjectFileMap,
  root = workspaceRoot
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
    importingProjects: {},
  };

  const seen = new Set<string>();

  options.helperDependencies?.forEach((dep) => {
    const node = findHelperDependencyNode(graph, projectNode.name, dep);
    if (!node) {
      return;
    }
    seen.add(node.name);
    npmDeps.dependencies[node.data.packageName] = node.data.version;
    recursivelyCollectPeerDependencies(node.name, graph, npmDeps, seen, root);
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
    root,
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
  root: string,
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
        npmDeps.importingProjects[node.data.packageName] = projectNode.name;
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
        npmDeps.importingProjects[node.data.packageName] = projectNode.name;
        recursivelyCollectPeerDependencies(
          node.name,
          graph,
          npmDeps,
          seen,
          root
        );
      } else if (graph.nodes[dep]) {
        findAllNpmDeps(
          projectFileMap,
          graph.nodes[dep],
          graph,
          npmDeps,
          seen,
          root,
          ignoredDependencies,
          dependencyPatterns,
          undefined,
          true
        );
      }
    }
  }
}

function findHelperDependencyNode(
  graph: ProjectGraph,
  projectName: string,
  dep: string
): ProjectGraphExternalNode | undefined {
  const bareNode = graph.externalNodes[dep];
  if (bareNode && !isLinkNode(bareNode)) {
    return bareNode;
  }
  // A helper with several versions can have only versioned nodes, for
  // example when the pnpm root importer does not declare it, and an outside
  // `link:` can then hold the bare name. Prefer the version that the project
  // depends on, else the highest registry version, else the link.
  const packageName = dep.replace(/^npm:/, '');
  const projectDependency = graph.dependencies[projectName]?.find(
    (d) => graph.externalNodes[d.target]?.data.packageName === packageName
  );
  return projectDependency
    ? graph.externalNodes[projectDependency.target]
    : findNodeMatchingVersion(graph, packageName, '*');
}

function recursivelyCollectPeerDependencies(
  projectName: string,
  graph: ProjectGraph,
  npmDeps: NpmDeps,
  seen: Set<string>,
  root: string
) {
  const npmPackage = graph.externalNodes[projectName];
  if (!npmPackage) {
    return npmDeps;
  }

  const packageName = npmPackage.data.packageName;
  try {
    const packageJson = readDependencyPackageJson(packageName, root);
    if (!packageJson.peerDependencies) {
      return npmDeps;
    }

    Object.keys(packageJson.peerDependencies)
      .map((dependencyName) => `npm:${dependencyName}`)
      .map((dependency) => graph.externalNodes[dependency])
      .filter(Boolean)
      .forEach((node) => {
        const isOptional =
          packageJson.peerDependenciesMeta?.[node.data.packageName]?.optional;
        if (!seen.has(node.name)) {
          seen.add(node.name);
          npmDeps.peerDependencies[node.data.packageName] = node.data.version;
          if (isOptional) {
            npmDeps.peerDependenciesMeta[node.data.packageName] = {
              optional: true,
            };
          }
          recursivelyCollectPeerDependencies(
            node.name,
            graph,
            npmDeps,
            seen,
            root
          );
        } else if (!isOptional) {
          // A peer stays optional only while every host declaring it says so.
          delete npmDeps.peerDependenciesMeta[node.data.packageName];
        }
      });
    return npmDeps;
  } catch (e) {
    logger.verbose(
      `Could not read the package.json of ${packageName}, so its peer dependencies were not collected: ${e.message}`
    );
    return npmDeps;
  }
}

// Watch builds collect peers on every compilation, so read each manifest once.
const dependencyPackageJsonCache = new Map<string, PackageJson>();

function readDependencyPackageJson(
  packageName: string,
  root: string
): PackageJson {
  const cacheKey = `${root}\0${packageName}`;
  let packageJson = dependencyPackageJsonCache.get(cacheKey);
  if (!packageJson) {
    // nx's own location first: under pnpm it reaches the hidden hoisted
    // .pnpm/node_modules, which the workspace root does not.
    ({ packageJson } = readModulePackageJson(packageName, [__dirname, root]));
    dependencyPackageJsonCache.set(cacheKey, packageJson);
  }
  return packageJson;
}
