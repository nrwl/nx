import { existsSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import {
  basename,
  dirname,
  join,
  posix,
  relative,
  isAbsolute,
  resolve,
} from 'node:path';
import { clean, satisfies, valid } from 'semver';
import type {
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import {
  createProjectRootMappings,
  findProjectForPath,
} from '../../../../project-graph/utils/find-project-for-path';
import {
  type CatalogManager,
  getCatalogManager,
} from '../../../../utils/catalog';
import { isRelativePath, readJsonFile } from '../../../../utils/fileutils';
import { getPackageNameFromImportPath } from '../../../../utils/get-package-name-from-import-path';
import type { PackageJson } from '../../../../utils/package-json';
import { isContainedRelativePath, normalizePath } from '../../../../utils/path';
import { workspaceRoot } from '../../../../utils/workspace-root';
import {
  getWorkspacePackagesMetadata,
  matchImportToWildcardEntryPointsToProjectMap,
} from '../../utils/packages';
import { resolveRelativeToDir } from '../../utils/resolve-relative-to-dir';
import {
  getRootTsConfigFileName,
  isTypeScriptResolvable,
  resolveModuleByImport,
} from '../../utils/typescript';

/**
 * The key is a combination of the package name and the workspace relative directory
 * containing the file importing it e.g. `lodash__packages/my-lib`, the value is the
 * resolved external node name from the project graph.
 */
type NpmResolutionCache = Map<string, string | null>;
type PackageJsonResolutionCache = Map<string, PackageJson | null>;

type PathPattern = {
  pattern: string;
  prefix: string;
  suffix: string;
};
type ParsedPatterns = {
  matchableStrings: Set<string> | undefined;
  patterns: PathPattern[] | undefined;
};
type LinkedProjectTarget = {
  project: string;
  externalNode: string;
};

function isLinkedProjectTarget(
  target: string | LinkedProjectTarget
): target is LinkedProjectTarget {
  return typeof target === 'object' && target !== null;
}

/**
 * Use a shared cache to avoid repeated npm package resolution work within the TargetProjectLocator.
 */
const defaultNpmResolutionCache: NpmResolutionCache = new Map();
const defaultPackageJsonResolutionCache: PackageJsonResolutionCache = new Map();
// Locators on the default cache share the local-path resolutions of one record
let defaultLocalPathNpmResolutionCache:
  | { recordKey: string; cache: NpmResolutionCache }
  | undefined;

// A plain x.y.z that semver's valid() accepts, which spares most nodes the
// parse. The 15-digit cap keeps each number under Number.MAX_SAFE_INTEGER
const plainSemverVersion =
  /^(0|[1-9]\d{0,14})\.(0|[1-9]\d{0,14})\.(0|[1-9]\d{0,14})$/;

// The version of an alias target, `npm:<target>@<version>`. The search starts
// past the `@` of a scoped target
function getAliasTargetVersion(version: string): string | undefined {
  const separator = version.indexOf('@', 'npm:'.length + 1);
  return separator === -1 ? undefined : version.slice(separator + 1);
}

const experimentalNodeModules = new Set(['node:sqlite']);

/**
 * Package root for a file that Node resolved inside `node_modules/<name>/`.
 * `realpath` keeps that directory for a normal install, including pnpm's store path.
 */
function installedPackageJsonFromResolvedFile(
  resolvedFile: string | null | undefined,
  packageName: string
): string | null {
  if (!resolvedFile) {
    return null;
  }
  const normalized = resolvedFile.replace(/\\/g, '/');
  const marker = `/node_modules/${packageName}/`;
  const index = normalized.lastIndexOf(marker);
  if (index === -1) {
    return null;
  }
  const root = normalized.slice(0, index + marker.length - 1);
  return join(root, 'package.json');
}

function isNestedPackageName(
  manifestName: string | undefined,
  packageName: string
): boolean {
  return !!manifestName && manifestName.startsWith(`${packageName}/`);
}

function getNpmResolutionCacheKey(
  packageName: string,
  filePath: string
): string {
  const workspaceRelativeFilePath = filePath.startsWith(workspaceRoot)
    ? filePath.replace(workspaceRoot, '')
    : filePath;
  return `${packageName}__${dirname(workspaceRelativeFilePath)}`;
}

function isInNodeModules(path: string): boolean {
  return path.startsWith('node_modules/') || path.includes('/node_modules/');
}

// Node's isBuiltin is false for Bun's runtime modules (`bun`, `bun:*`).
function isBunModuleImport(importExpr: string): boolean {
  return importExpr === 'bun' || importExpr.startsWith('bun:');
}

export function isBuiltinModuleImport(importExpr: string): boolean {
  const packageName = getPackageNameFromImportPath(importExpr);
  return (
    isBuiltin(packageName) ||
    experimentalNodeModules.has(packageName) ||
    isBunModuleImport(importExpr)
  );
}

// TypeScript matches the `${configDir}` template case-insensitively and only as a
// prefix (commandLineParser.ts `startsWithConfigDirTemplate`).
const configDirTemplate = '${configDir}';
function startsWithConfigDirTemplate(value: string): boolean {
  return value.toLowerCase().startsWith(configDirTemplate.toLowerCase());
}

export class TargetProjectLocator {
  private projectRootMappings = createProjectRootMappings(this.nodes);
  private npmProjects: Record<string, ProjectGraphExternalNode | null>;
  private packageNamesWithSeveralNodes: Set<string> | undefined;
  private packageNamesWithLocalPathNodes = new Set<string>();
  // Resolutions of packageNamesWithLocalPathNodes depend on this locator's
  // installedLocalPathNodes, so they stay out of the shared cache
  private localPathNpmResolutionCache: NpmResolutionCache = new Map();
  // Nodes the node_modules walk resolved. They depend on this build's graph,
  // so the shared caches never hold them
  private readonly nodeModulesWalkResolutions = new Map<
    string,
    { nodeName: string; walkOnly: boolean }
  >();
  private readonly nodeModulesWalkManifestsByPath = new Map<
    string,
    PackageJson | null
  >();
  // The fallback result of imports whose walk manifest was not accepted. A
  // later graph can accept it, so they stay out of the shared cache
  private readonly declinedNodeModulesWalks = new Map<string, string | null>();
  // The relative and absolute forms of an importer have their own resolution
  // keys, so the walk result is also kept per package and importing directory
  private readonly nodeModulesWalkManifestsByImporter = new Map<
    string,
    PackageJson | null
  >();
  // Set by findNpmProjectFromImport, so its callers need no second key lookup
  private lastNpmResolutionWasWalkOnly = false;
  private packageNamesWithLocalPathVersionNodes: Set<string> | undefined;
  private readonly hasInstalledLocalPathNodes =
    Object.keys(this.installedLocalPathNodes).length > 0;
  private readonly realPaths = new Map<string, string>();
  private tsConfig = this.getRootTsConfig();
  private paths = this.tsConfig.config?.compilerOptions?.paths;
  private parsedPathPatterns: ParsedPatterns | undefined;
  private typescriptResolutionCache = new Map<string, string | null>();
  private typescriptResolvable: boolean | undefined;
  private linkedProjectCache = new Map<string, string | null>();
  private catalogManager: CatalogManager | null | undefined;
  private packagesMetadata: {
    entryPointsToProjectMap: Record<string, ProjectGraphProjectNode>;
    wildcardEntryPointsToProjectMap: Record<string, ProjectGraphProjectNode>;
    packageToProjectMap: Record<string, ProjectGraphProjectNode>;
  };

  constructor(
    private readonly nodes: Record<string, ProjectGraphProjectNode>,
    private readonly externalNodes: Record<
      string,
      ProjectGraphExternalNode
    > = {},
    private readonly npmResolutionCache: NpmResolutionCache = defaultNpmResolutionCache,
    private readonly packageJsonResolutionCache: PackageJsonResolutionCache = defaultPackageJsonResolutionCache,
    // The local-path node each importer installs per package name, keyed by
    // the importer's workspace-relative root ('.' for the workspace root).
    // Without it, a vendored package resolves by version and name.
    private readonly installedLocalPathNodes: Record<
      string,
      Record<string, string>
    > = {}
  ) {
    for (const installed of Object.values(this.installedLocalPathNodes)) {
      for (const packageName of Object.keys(installed)) {
        this.packageNamesWithLocalPathNodes.add(packageName);
      }
    }
    if (
      this.packageNamesWithLocalPathNodes.size &&
      this.npmResolutionCache === defaultNpmResolutionCache
    ) {
      const recordKey = JSON.stringify(this.installedLocalPathNodes);
      if (defaultLocalPathNpmResolutionCache?.recordKey !== recordKey) {
        defaultLocalPathNpmResolutionCache = { recordKey, cache: new Map() };
      }
      this.localPathNpmResolutionCache =
        defaultLocalPathNpmResolutionCache.cache;
    }
    /**
     * Only the npm external nodes should be included.
     *
     * Unlike the raw externalNodes, ensure that there is always copy of the node where the version
     * is set in the key for optimal lookup.
     */
    this.npmProjects = Object.values(this.externalNodes).reduce(
      (acc, node) => {
        if (node.type === 'npm') {
          const keyWithVersion = `npm:${node.data.packageName}@${node.data.version}`;
          if (!acc[node.name]) {
            acc[node.name] = node;
          }
          // The node.name may have already contained the version
          if (!acc[keyWithVersion]) {
            acc[keyWithVersion] = node;
          }
        }
        return acc;
      },
      {} as Record<string, ProjectGraphExternalNode>
    );

    if (this.tsConfig.config?.compilerOptions?.paths) {
      this.parsePaths(this.tsConfig.config.compilerOptions.paths);
    }
  }

  /**
   * Resolve any workspace or external project that matches the given import expression,
   * originating from the given filePath.
   *
   * @param importExpr
   * @param filePath
   */
  findProjectFromImport(importExpr: string, filePath: string): string {
    const target = this.resolveImportTarget(importExpr, filePath);
    return isLinkedProjectTarget(target) ? target.project : target;
  }

  /**
   * The targets of an import's dependencies: the one `findProjectFromImport`
   * returns, plus the external node of the `link:` package that resolved the
   * import to that project.
   */
  findDependencyTargetsFromImport(
    importExpr: string,
    filePath: string
  ): string[] {
    const target = this.resolveImportTarget(importExpr, filePath);
    if (isLinkedProjectTarget(target)) {
      return [target.project, target.externalNode];
    }
    return target ? [target] : [];
  }

  private resolveImportTarget(
    importExpr: string,
    filePath: string
  ): string | LinkedProjectTarget {
    if (isRelativePath(importExpr)) {
      const resolvedModule = posix.join(dirname(filePath), importExpr);
      return this.findProjectOfResolvedModule(resolvedModule);
    }

    // find project using tsconfig paths
    const results = this.findMatchingPaths(importExpr);
    if (results) {
      const [path, paths] = results;
      const matchedStar =
        typeof path === 'string'
          ? undefined
          : importExpr.substring(
              path.prefix.length,
              importExpr.length - path.suffix.length
            );
      for (let p of paths) {
        let path = matchedStar ? p.replace('*', matchedStar) : p;
        if (startsWithConfigDirTemplate(path)) {
          path = this.substituteConfigDirTemplate(path, filePath);
        }
        const maybeResolvedProject = this.findProjectOfResolvedModule(path);
        if (maybeResolvedProject) {
          return maybeResolvedProject;
        }
      }
    }

    if (isBuiltinModuleImport(importExpr)) {
      return null;
    }

    // try to find npm package before using expensive typescript resolution
    const externalProject = this.findNpmProjectFromImport(importExpr, filePath);
    // A node only the node_modules walk found applies only when the lookups
    // below, which run without the walk, find nothing
    const walkOnlyResolution =
      !!externalProject && this.lastNpmResolutionWasWalkOnly;
    if (externalProject && !walkOnlyResolution) {
      return this.withLinkedProject(externalProject, importExpr, filePath);
    }

    if (
      this.tsConfig.config &&
      (this.typescriptResolvable ??= isTypeScriptResolvable())
    ) {
      // TODO: this can be removed once we rework resolveImportWithRequire below
      // to properly handle ESM (exports, imports, conditions)
      const resolvedProject = this.resolveImportWithTypescript(
        importExpr,
        filePath
      );
      if (resolvedProject) {
        return resolvedProject;
      }
    }

    let resolvedWithRequire = false;
    try {
      const resolvedModule = this.resolveImportWithRequire(
        importExpr,
        filePath
      );
      resolvedWithRequire = true;
      const resolvedProject = this.findProjectOfResolvedModule(resolvedModule);
      if (resolvedProject || !walkOnlyResolution) {
        return resolvedProject;
      }
    } catch {}

    if (!resolvedWithRequire) {
      // fall back to see if it's a locally linked workspace project where the
      // output might not exist yet
      const localProject = this.findImportInWorkspaceProjects(importExpr);
      if (localProject) {
        return localProject;
      }
    }

    if (walkOnlyResolution) {
      return this.withLinkedProject(externalProject, importExpr, filePath);
    }

    // nothing found, cache the negative result with the scoped key. Declined
    // walks stay on the locator (see declinedNodeModulesWalks)
    const packageName = getPackageNameFromImportPath(importExpr);
    const npmImportForProject = getNpmResolutionCacheKey(packageName, filePath);
    if (!this.declinedNodeModulesWalks.has(npmImportForProject)) {
      this.getNpmResolutionCache(packageName).set(npmImportForProject, null);
    }
    return null;
  }

  private withLinkedProject(
    externalProject: string,
    importExpr: string,
    filePath: string
  ): string | LinkedProjectTarget {
    const project = this.findLinkedProject(
      externalProject,
      importExpr,
      filePath
    );
    return project
      ? { project, externalNode: externalProject }
      : externalProject;
  }

  /**
   * Resolve any external project that matches the given import expression,
   * relative to the given file path.
   *
   * @param importExpr
   * @param projectRoot
   */
  findNpmProjectFromImport(
    importExpr: string,
    fromFilePath: string
  ): string | null {
    this.lastNpmResolutionWasWalkOnly = false;
    const packageName = getPackageNameFromImportPath(importExpr);

    const fullDirPath = dirname(
      fromFilePath.startsWith(workspaceRoot)
        ? fromFilePath
        : join(workspaceRoot, fromFilePath)
    );

    const npmImportForProject = getNpmResolutionCacheKey(
      packageName,
      fromFilePath
    );
    const npmResolutionCache = this.getNpmResolutionCache(packageName);
    if (npmResolutionCache.has(npmImportForProject)) {
      return npmResolutionCache.get(npmImportForProject);
    }
    const walkResolution =
      this.nodeModulesWalkResolutions.get(npmImportForProject);
    if (walkResolution) {
      this.lastNpmResolutionWasWalkOnly = walkResolution.walkOnly;
      return walkResolution.nodeName;
    }
    if (this.declinedNodeModulesWalks.has(npmImportForProject)) {
      return this.declinedNodeModulesWalks.get(npmImportForProject);
    }

    try {
      // package.json refers to an external package, we do not match against the version found in there, we instead try and resolve the relevant package how node would
      const manifestSource = { nodeModulesWalk: false };
      let externalPackageJson = this.readPackageJson(
        packageName,
        fullDirPath,
        manifestSource
      );
      // A manifest only the node_modules walk read counts when the graph has
      // the exact node for it. Otherwise the package stays unreadable
      const walkNode = manifestSource.nodeModulesWalk
        ? this.findNodeModulesWalkNode(
            packageName,
            externalPackageJson,
            fullDirPath
          )
        : null;
      const declinedWalk = manifestSource.nodeModulesWalk && !walkNode;
      if (declinedWalk) {
        externalPackageJson = null;
      }
      // The external package.json path might be not be resolvable, e.g. if a reference has been added to a project package.json, but the install command has not been run yet.
      if (!externalPackageJson) {
        // A local package whose target is missing, such as a `link:` to
        // output that isn't built yet, keeps the node the lockfile records
        const installedNodeName = this.packageNamesWithLocalPathNodes.has(
          packageName
        )
          ? this.findUnreadableLocalPathNpmProjectFromDir(
              packageName,
              fullDirPath
            )
          : null;
        // Try and fall back to resolving an external node from the graph by name
        const externalNode = this.npmProjects[`npm:${packageName}`];
        const externalNodeName =
          installedNodeName ?? (externalNode?.name || null);
        (declinedWalk ? this.declinedNodeModulesWalks : npmResolutionCache).set(
          npmImportForProject,
          externalNodeName
        );
        return externalNodeName;
      }

      if (walkNode) {
        // Without the walk the import resolves to null unless the graph has
        // the unversioned node or the lockfile records a local package
        const walkOnly =
          !this.npmProjects[`npm:${packageName}`] &&
          !(
            this.packageNamesWithLocalPathNodes.has(packageName) &&
            this.findUnreadableLocalPathNpmProjectFromDir(
              packageName,
              fullDirPath
            )
          );
        const nodeName = walkNode.name;
        this.nodeModulesWalkResolutions.set(npmImportForProject, {
          nodeName,
          walkOnly,
        });
        this.lastNpmResolutionWasWalkOnly = walkOnly;
        return nodeName;
      }

      const version = clean(externalPackageJson.version);
      const isAliasImport = packageName !== externalPackageJson.name;
      let matchingExternalNode: ProjectGraphExternalNode | null = null;

      if (isAliasImport) {
        // A local package installed under another name gets the node the
        // lockfile records for that name
        const installedNodeName = this.packageNamesWithLocalPathNodes.has(
          packageName
        )
          ? this.findInstalledLocalPathNpmProjectFromDir(
              packageName,
              fullDirPath
            )
          : null;
        // Prefer the alias node when both the alias import and the resolved package
        // exist in the graph, otherwise generated package.json files lose the alias key.
        const aliasNpmProjectKey = `npm:${packageName}@npm:${externalPackageJson.name}@${version}`;
        matchingExternalNode = installedNodeName
          ? this.npmProjects[installedNodeName]
          : (this.npmProjects[aliasNpmProjectKey] ??
            this.npmProjects[`npm:${packageName}`]);
      }

      if (!matchingExternalNode) {
        const versionedNode =
          this.npmProjects[`npm:${externalPackageJson.name}@${version}`];
        // A vendored copy can share its name and version with a registry
        // package, so the lockfile's record of what was installed decides
        const installedNodeName =
          this.packageNamesWithLocalPathNodes.has(packageName) &&
          (!versionedNode || this.hasSeveralNodes(externalPackageJson.name))
            ? this.findInstalledLocalPathNpmProjectFromDir(
                packageName,
                fullDirPath
              )
            : null;
        matchingExternalNode = installedNodeName
          ? this.npmProjects[installedNodeName]
          : versionedNode;
      }

      if (!matchingExternalNode) {
        // Fallback to package name as key. This can happen if the version in project graph is not the same as in the resolved package.json.
        // e.g. Version in project graph is a git remote, but the resolved version is semver.
        matchingExternalNode =
          this.npmProjects[`npm:${externalPackageJson.name}`];
      }

      if (!matchingExternalNode) {
        return null;
      }

      npmResolutionCache.set(npmImportForProject, matchingExternalNode.name);
      return matchingExternalNode.name;
    } catch (e) {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.error(e);
      }
      return null;
    }
  }

  /**
   * The external node of the local package that the importer at
   * `importerRoot` installs for `packageName`, as the lockfile records it. An
   * override can replace the copy a `file:` or `link:` spec names, so the spec
   * alone does not tell.
   *
   * @param importerRoot the importer's workspace-relative root, '.' for the
   * workspace root
   */
  findInstalledLocalPathNpmProject(
    packageName: string,
    importerRoot: string
  ): string | null {
    const nodeName = this.installedLocalPathNodes[importerRoot]?.[packageName];
    return (nodeName && this.npmProjects[nodeName]?.name) ?? null;
  }

  /**
   * The external node of the local package behind the copy an import resolves
   * to: the record of the nearest importer up to the workspace root, unless a
   * directory on the way has its own copy, which the import loads instead.
   */
  private findInstalledLocalPathNpmProjectFromDir(
    packageName: string,
    fromDirPath: string
  ): string | null {
    for (let dir = fromDirPath; ; dir = dirname(dir)) {
      const relativeDir = relative(workspaceRoot, dir);
      if (relativeDir && !isContainedRelativePath(relativeDir)) {
        return null;
      }
      const installed = this.findInstalledLocalPathNpmProject(
        packageName,
        relativeDir ? normalizePath(relativeDir) : '.'
      );
      if (installed) {
        return installed;
      }
      if (
        !relativeDir ||
        existsSync(join(dir, 'node_modules', packageName, 'package.json'))
      ) {
        return null;
      }
    }
  }

  /**
   * The node an unreadable import gets once its package can be read: the
   * record of the nearest importer up to the directory that installs the
   * package. Null when no directory installs it.
   */
  private findUnreadableLocalPathNpmProjectFromDir(
    packageName: string,
    fromDirPath: string
  ): string | null {
    let installed: string | null = null;
    for (let dir = fromDirPath; ; dir = dirname(dir)) {
      const relativeDir = relative(workspaceRoot, dir);
      if (relativeDir && !isContainedRelativePath(relativeDir)) {
        return null;
      }
      installed ??= this.findInstalledLocalPathNpmProject(
        packageName,
        relativeDir ? normalizePath(relativeDir) : '.'
      );
      if (hasEntry(join(dir, 'node_modules', packageName))) {
        return installed;
      }
      if (!relativeDir) {
        return null;
      }
    }
  }

  /**
   * The project that holds the target of the importer's installed `link:`
   * package.
   * pnpm and Bun give such a link an external node, which would otherwise
   * shadow the project. Importers can share that node with different targets,
   * so the link the importer installs decides.
   */
  findLinkedProject(
    externalNodeName: string,
    importExpr: string,
    fromFilePath: string
  ): string | null {
    const version = this.npmProjects[externalNodeName]?.data.version;
    if (typeof version !== 'string' || !version.startsWith('link:')) {
      return null;
    }
    const packageName = getPackageNameFromImportPath(importExpr);
    const fullDirPath = dirname(
      fromFilePath.startsWith(workspaceRoot)
        ? fromFilePath
        : join(workspaceRoot, fromFilePath)
    );
    const cacheKey = `${packageName}__${fullDirPath}`;
    if (!this.linkedProjectCache.has(cacheKey)) {
      this.linkedProjectCache.set(
        cacheKey,
        this.findLinkedProjectFromDir(packageName, fullDirPath)
      );
    }
    return this.linkedProjectCache.get(cacheKey);
  }

  // Node loads the nearest node_modules copy, so that one decides. A link
  // whose target isn't built yet decides only when no copy is installed above
  // it, so the edge doesn't depend on whether the target was built.
  private findLinkedProjectFromDir(
    packageName: string,
    fromDirPath: string
  ): string | null {
    let unbuiltTarget: string | undefined;
    for (let dir = fromDirPath; ; dir = dirname(dir)) {
      const relativeDir = relative(workspaceRoot, dir);
      if (relativeDir && !isContainedRelativePath(relativeDir)) {
        break;
      }
      const installedPath = join(dir, 'node_modules', packageName);
      if (existsSync(installedPath)) {
        let target: string;
        try {
          target = realpathSync(installedPath);
        } catch {
          return null;
        }
        return this.findProjectHoldingLinkTarget(target);
      }
      unbuiltTarget ??= resolveDanglingLink(installedPath);
      if (!relativeDir) {
        break;
      }
    }
    return unbuiltTarget
      ? this.findProjectHoldingLinkTarget(unbuiltTarget)
      : null;
  }

  private findProjectHoldingLinkTarget(target: string): string | null {
    const path = normalizePath(relative(workspaceRoot, target));
    if (isInNodeModules(path)) {
      return null;
    }
    const project = findProjectForPath(path, this.projectRootMappings);
    // A root project holds every path, so it doesn't claim a link
    return project && this.nodes[project].data.root !== '.' ? project : null;
  }

  private getNpmResolutionCache(packageName: string): NpmResolutionCache {
    return this.packageNamesWithLocalPathNodes.has(packageName)
      ? this.localPathNpmResolutionCache
      : this.npmResolutionCache;
  }

  // Only the exact version node, or alias node, counts. A local-path node under
  // either name rules it out, since the copy could then be that local package
  private findNodeModulesWalkNode(
    packageName: string,
    packageJson: PackageJson | null,
    fromDirPath: string
  ): ProjectGraphExternalNode | null {
    if (!packageJson) {
      return null;
    }
    if (
      this.isInstalledFromLocalPath(packageName, fromDirPath) ||
      (packageName !== packageJson.name &&
        this.isInstalledFromLocalPath(packageJson.name, fromDirPath))
    ) {
      return null;
    }
    const version = clean(packageJson.version);
    // clean() would match a local 1.0.0+build copy to the registry 1.0.0 node
    if (version !== packageJson.version) {
      return null;
    }
    return (
      this.npmProjects[
        packageName === packageJson.name
          ? `npm:${packageJson.name}@${version}`
          : `npm:${packageName}@npm:${packageJson.name}@${version}`
      ] ?? null
    );
  }

  // A record tells which local copy this importer installs. A node without a
  // record tells only that some importer installs one
  private isInstalledFromLocalPath(
    packageName: string,
    fromDirPath: string
  ): boolean {
    return (
      (this.hasInstalledLocalPathNodes &&
        !!this.findInstalledLocalPathNpmProjectFromDir(
          packageName,
          fromDirPath
        )) ||
      this.hasLocalPathVersionNode(packageName)
    );
  }

  // Built on first use, since only walk manifests need it
  private hasLocalPathVersionNode(packageName: string): boolean {
    if (!this.packageNamesWithLocalPathVersionNodes) {
      this.packageNamesWithLocalPathVersionNodes = new Set();
      const recorded = new Set<string>();
      for (const installed of Object.values(this.installedLocalPathNodes)) {
        for (const nodeName of Object.values(installed)) {
          const node = this.externalNodes[nodeName];
          if (node) {
            recorded.add(`${node.data.packageName}@${node.data.version}`);
          }
        }
      }
      for (const node of Object.values(this.externalNodes)) {
        if (node.type !== 'npm' || typeof node.data.version !== 'string') {
          continue;
        }
        // Only a semver version, or an alias to one, is known to come from the
        // registry. Others can be file:, link:, tarball paths, URLs or git
        const version = node.data.version.startsWith('npm:')
          ? getAliasTargetVersion(node.data.version)
          : node.data.version;
        if (
          (version === undefined ||
            (!plainSemverVersion.test(version) && valid(version) === null)) &&
          !recorded.has(`${node.data.packageName}@${node.data.version}`)
        ) {
          this.packageNamesWithLocalPathVersionNodes.add(node.data.packageName);
        }
      }
    }
    return this.packageNamesWithLocalPathVersionNodes.has(packageName);
  }

  // Built on first use, since only names with a local-path node need it
  private hasSeveralNodes(packageName: string): boolean {
    if (!this.packageNamesWithSeveralNodes) {
      this.packageNamesWithSeveralNodes = new Set();
      const seenPackageNames = new Set<string>();
      for (const node of Object.values(this.externalNodes)) {
        if (node.type !== 'npm') {
          continue;
        }
        if (seenPackageNames.has(node.data.packageName)) {
          this.packageNamesWithSeveralNodes.add(node.data.packageName);
        }
        seenPackageNames.add(node.data.packageName);
      }
    }
    return this.packageNamesWithSeveralNodes.has(packageName);
  }

  /**
   * Return file paths matching the import relative to the repo root
   * @param normalizedImportExpr
   * @deprecated Use `findMatchingPaths` instead. It will be removed in Nx v22.
   */
  findPaths(normalizedImportExpr: string): string[] | undefined {
    if (!this.paths) {
      return undefined;
    }
    if (this.paths[normalizedImportExpr]) {
      return [normalizedImportExpr, this.paths[normalizedImportExpr]];
    }
    const wildcardPath = Object.keys(this.paths).find(
      (path) =>
        path.endsWith('/*') &&
        (normalizedImportExpr.startsWith(path.replace(/\*$/, '')) ||
          normalizedImportExpr === path.replace(/\/\*$/, ''))
    );
    if (wildcardPath) {
      return [wildcardPath, this.paths[wildcardPath]];
    }
    return undefined;
  }

  findMatchingPaths(
    importExpr: string
  ): [pattern: string | PathPattern, paths: string[]] | undefined {
    if (!this.parsedPathPatterns) {
      return undefined;
    }

    const { matchableStrings, patterns } = this.parsedPathPatterns;
    if (matchableStrings.has(importExpr)) {
      return [importExpr, this.paths[importExpr]];
    }

    // https://github.com/microsoft/TypeScript/blob/29e6d6689dfb422e4f1395546c1917d07e1f664d/src/compiler/core.ts#L2410
    let matchedValue: PathPattern | undefined;
    let longestMatchPrefixLength = -1;
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      if (
        pattern.prefix.length > longestMatchPrefixLength &&
        this.isPatternMatch(pattern, importExpr)
      ) {
        longestMatchPrefixLength = pattern.prefix.length;
        matchedValue = pattern;
      }
    }

    return matchedValue
      ? [matchedValue, this.paths[matchedValue.pattern]]
      : undefined;
  }

  findImportInWorkspaceProjects(importPath: string): string | null {
    this.packagesMetadata ??= getWorkspacePackagesMetadata(this.nodes);
    const slashIndex = importPath.indexOf('/');
    const impPath =
      importPath[0] !== '@' && slashIndex > 0
        ? importPath.slice(0, slashIndex)
        : importPath;
    if (this.packagesMetadata.entryPointsToProjectMap[impPath]) {
      return this.packagesMetadata.entryPointsToProjectMap[impPath].name;
    }

    const project = matchImportToWildcardEntryPointsToProjectMap(
      this.packagesMetadata.wildcardEntryPointsToProjectMap,
      importPath
    );

    return project?.name;
  }

  findDependencyInWorkspaceProjects(
    packageJsonPath: string,
    dep: string,
    packageVersion: string
  ): string | null {
    this.packagesMetadata ??= getWorkspacePackagesMetadata(this.nodes);

    const maybeDep = this.packagesMetadata.packageToProjectMap[dep];

    const maybeDepMetadata = maybeDep?.data.metadata.js;

    if (!maybeDepMetadata) {
      return null;
    }

    let specifier = packageVersion;
    let isCatalogSpecifier = false;
    if (this.catalogManager === undefined) {
      this.catalogManager = getCatalogManager(workspaceRoot);
    }
    if (this.catalogManager?.isCatalogReference(packageVersion)) {
      const catalogValue = this.catalogManager.resolveCatalogReference(
        workspaceRoot,
        dep,
        packageVersion
      );
      if (typeof catalogValue !== 'string') {
        return null;
      }
      specifier = catalogValue;
      isCatalogSpecifier = true;
    }

    const workspaceRegex = /^workspace:/;
    const hasWorkspaceProtocol = workspaceRegex.test(specifier);
    const normalizedRange = specifier.replace(workspaceRegex, '');

    /**
     * Regex is needed to test for workspace: protocol because following options are all valid:
     *  - workspace:*
     *  - workspace:^
     *  - workspace:~
     *  - workspace:foo@*
     */
    if (hasWorkspaceProtocol || normalizedRange === '*') {
      return maybeDep?.name;
    }

    if (normalizedRange.startsWith('file:')) {
      const targetPath = maybeDep?.data.root;

      const normalizedPath = normalizedRange.replace('file:', '');
      // Package managers resolve a catalog's `file:` paths from the workspace root
      const resolvedPath = posix.join(
        isCatalogSpecifier ? '.' : dirname(packageJsonPath),
        normalizedPath
      );

      if (targetPath === resolvedPath) {
        return maybeDep?.name;
      }
    }

    if (
      satisfies(maybeDepMetadata.packageVersion, normalizedRange, {
        includePrerelease: true,
      })
    ) {
      return maybeDep?.name;
    }

    return null;
  }

  private isPatternMatch(
    { prefix, suffix }: PathPattern,
    candidate: string
  ): boolean {
    return (
      candidate.length >= prefix.length + suffix.length &&
      candidate.startsWith(prefix) &&
      candidate.endsWith(suffix)
    );
  }

  private parsePaths(paths: Record<string, string>): void {
    this.parsedPathPatterns = {
      matchableStrings: new Set(),
      patterns: [],
    };

    for (const key of Object.keys(paths)) {
      const parts = key.split('*');
      if (parts.length > 2) {
        continue;
      }
      if (parts.length === 1) {
        this.parsedPathPatterns.matchableStrings.add(key);
        continue;
      }
      this.parsedPathPatterns.patterns.push({
        pattern: key,
        prefix: parts[0],
        suffix: parts[1],
      });
    }
  }

  private resolveImportWithTypescript(
    normalizedImportExpr: string,
    filePath: string
  ): string | undefined {
    let resolvedModule: string;
    if (!isAbsolute(filePath)) {
      // Convert to an absolute file path because TypeScript's module resolution won't
      // properly walk up the directory tree (toward the workspace root) when given a relative path.
      filePath = this.getAbsolutePath(filePath);
    }
    const projectName = findProjectForPath(filePath, this.projectRootMappings);
    const cacheScope = projectName
      ? // fall back to the project name if the project root can't be determined
        this.nodes[projectName]?.data?.root || projectName
      : // fall back to the file path if the project can't be determined
        filePath;
    const cacheKey = `${normalizedImportExpr}__${cacheScope}`;
    if (this.typescriptResolutionCache.has(cacheKey)) {
      resolvedModule = this.typescriptResolutionCache.get(cacheKey);
    } else {
      resolvedModule = resolveModuleByImport(
        normalizedImportExpr,
        filePath,
        this.tsConfig.absolutePath
      );
      this.typescriptResolutionCache.set(
        cacheKey,
        resolvedModule ? resolvedModule : null
      );
    }

    if (!resolvedModule) {
      return;
    }

    const nodeModulesIndex = resolvedModule.lastIndexOf('node_modules/');
    if (nodeModulesIndex === -1) {
      const resolvedProject = this.findProjectOfResolvedModule(resolvedModule);
      return resolvedProject;
    }

    // strip the node_modules/ prefix from the resolved module path
    const packagePath = resolvedModule.substring(
      nodeModulesIndex + 'node_modules/'.length
    );
    const externalProject = this.findNpmProjectFromImport(
      packagePath,
      filePath
    );
    // A node only the node_modules walk found must not stop the lookups that
    // follow, which can find a workspace project
    if (externalProject && this.lastNpmResolutionWasWalkOnly) {
      return undefined;
    }

    return externalProject;
  }

  private resolveImportWithRequire(
    normalizedImportExpr: string,
    filePath: string
  ) {
    return relative(
      workspaceRoot,
      require.resolve(normalizedImportExpr, {
        paths: [dirname(filePath)],
      })
    );
  }

  private findProjectOfResolvedModule(
    resolvedModule: string
  ): string | undefined {
    resolvedModule = normalizePath(resolvedModule);
    if (isInNodeModules(resolvedModule)) {
      return undefined;
    }
    let normalizedResolvedModule = resolvedModule.startsWith('./')
      ? resolvedModule.substring(2)
      : resolvedModule;
    // Remove trailing slash to ensure proper project matching
    if (normalizedResolvedModule.endsWith('/')) {
      normalizedResolvedModule = normalizedResolvedModule.slice(0, -1);
    }
    const importedProject = this.findMatchingProjectFiles(
      normalizedResolvedModule
    );
    return importedProject ? importedProject.name : void 0;
  }

  /**
   * Expand a `${configDir}` path mapping the same way TypeScript does. The
   * template resolves to the directory of the tsconfig used for compilation,
   * which for the importing file is its own project, so a configDir alias always
   * points back into the source project (matching what `tsc` resolves).
   */
  private substituteConfigDirTemplate(value: string, filePath: string): string {
    const sourceFilePath = isAbsolute(filePath)
      ? relative(workspaceRoot, filePath)
      : filePath;
    const sourceProjectName = findProjectForPath(
      sourceFilePath,
      this.projectRootMappings
    );
    const sourceProjectRoot = this.nodes[sourceProjectName]?.data.root ?? '.';

    // tsc replaces the template with './' and normalizes against the config dir;
    // here the config dir is the source project root (workspace-relative).
    return posix.join(
      sourceProjectRoot,
      value.replace(configDirTemplate, './')
    );
  }

  private getAbsolutePath(path: string) {
    return join(workspaceRoot, path);
  }

  private getRootTsConfig() {
    const path = getRootTsConfigFileName();
    if (!path) {
      return {
        path: null,
        absolutePath: null,
        config: null,
      };
    }

    const absolutePath = this.getAbsolutePath(path);
    return {
      absolutePath,
      path,
      config: readJsonFile(absolutePath),
    };
  }

  private findMatchingProjectFiles(file: string) {
    const project = findProjectForPath(file, this.projectRootMappings);
    return this.nodes[project];
  }

  /**
   * In many cases the package.json will be directly resolvable, so we try that first.
   * If, however, package exports are used and the package.json is not defined, we will
   * need to resolve the main entry point of the package and traverse upwards to find the
   * package.json.
   *
   * In some cases, such as when multiple module formats are published, the resolved package.json
   * might only contain the "type" field - no "name" or "version", so in such cases we keep traversing
   * until we find a package.json that contains the "name" and "version" fields.
   *
   * A nested manifest whose name is a subpath of the requested package (for example
   * `@stencil/core/internal`) is not that package. Prefer `node_modules/<name>/package.json`
   * — aliases keep that file's own name — and skip subpath manifests while walking up.
   */
  private readPackageJson(
    packageName: string,
    relativeToDir: string,
    manifestSource?: { nodeModulesWalk: boolean }
  ): PackageJson | null {
    const walkManifestKey = `${packageName}__${relativeToDir}`;
    if (this.nodeModulesWalkManifestsByImporter.has(walkManifestKey)) {
      const walkManifest =
        this.nodeModulesWalkManifestsByImporter.get(walkManifestKey);
      if (walkManifest && manifestSource) {
        manifestSource.nodeModulesWalk = true;
      }
      return walkManifest;
    }
    // Package specifiers use `/` on every OS. path.join() would use `\` on Windows.
    const packageJsonPath = resolveRelativeToDir(
      `${packageName}/package.json`,
      relativeToDir
    );
    if (packageJsonPath) {
      if (this.packageJsonResolutionCache.has(packageJsonPath)) {
        const cached = this.packageJsonResolutionCache.get(packageJsonPath);
        if (cached) {
          return cached;
        }
      }
      const parsedPackageJson = readJsonFile(packageJsonPath);

      if (parsedPackageJson.name && parsedPackageJson.version) {
        this.packageJsonResolutionCache.set(packageJsonPath, parsedPackageJson);
        return parsedPackageJson;
      }
    }

    try {
      // Resolve the main entry point of the package
      const pathOfFileInPackage =
        packageJsonPath ?? resolveRelativeToDir(packageName, relativeToDir);
      if (!pathOfFileInPackage) {
        // An installed package can fail both lookups (exports hide them, or the
        // entry file is missing). Read its manifest from node_modules instead.
        for (let dir = relativeToDir; ; dir = dirname(dir)) {
          const candidateDir = join(dir, 'node_modules', packageName);
          const candidatePath = join(candidateDir, 'package.json');
          // Node never looks in node_modules/node_modules
          const isLookupDir = basename(dir) !== 'node_modules';
          if (isLookupDir && !existsSync(candidatePath)) {
            // Node can serve subpaths from a nearer copy without a manifest,
            // so the copy further up is not known to be the one it loads
            if (existsSync(candidateDir)) {
              return null;
            }
          } else if (isLookupDir) {
            // Keep a package whose real path stays in this node_modules or
            // another one. Any other is a linked copy, not a registry package.
            const realPackageDir = this.realPath(dirname(candidatePath));
            const pathFromRealRoot = normalizePath(
              relative(this.realPath(workspaceRoot), realPackageDir)
            );
            const outsideNodeModules = !isInNodeModules(pathFromRealRoot);
            if (
              outsideNodeModules &&
              !isContainedRelativePath(
                relative(
                  this.realPath(join(dir, 'node_modules')),
                  realPackageDir
                )
              )
            ) {
              return null;
            }
            const installed = this.readNodeModulesWalkManifest(
              this.realPath(candidatePath)
            );
            // `clean()` throws on a version that is not a string, which
            // would skip the lookup by name
            if (!installed || typeof installed.version !== 'string') {
              // Node loads the nearest copy, so an unusable manifest ends the walk
              return null;
            }
            // A project's folder is not a registry copy, even when a symlinked
            // node_modules holds it
            const manifest =
              outsideNodeModules &&
              isContainedRelativePath(pathFromRealRoot) &&
              this.findProjectHoldingLinkTarget(
                join(workspaceRoot, pathFromRealRoot)
              )
                ? null
                : installed;
            this.nodeModulesWalkManifestsByImporter.set(
              walkManifestKey,
              manifest
            );
            if (manifest && manifestSource) {
              manifestSource.nodeModulesWalk = true;
            }
            return manifest;
          }
          if (dir === dirname(dir)) {
            return null;
          }
        }
      }
      const installedPackageJsonPath = installedPackageJsonFromResolvedFile(
        pathOfFileInPackage,
        packageName
      );
      if (
        installedPackageJsonPath &&
        installedPackageJsonPath !== packageJsonPath
      ) {
        const installedPackageJson = this.readCompletePackageJson(
          installedPackageJsonPath
        );
        if (installedPackageJson) {
          return installedPackageJson;
        }
      }

      let dir = dirname(pathOfFileInPackage);

      while (dir !== dirname(dir)) {
        const candidatePath = join(dir, 'package.json');
        if (this.packageJsonResolutionCache.has(candidatePath)) {
          const cached = this.packageJsonResolutionCache.get(candidatePath);
          if (
            cached?.name &&
            cached.version &&
            !isNestedPackageName(cached.name, packageName)
          ) {
            return cached;
          }
          // Cached incomplete manifests, and nested packages, are traversal points.
        } else {
          try {
            const parsedPackageJson = readJsonFile(candidatePath);
            // Ensure the package.json contains the "name" and "version" fields
            if (parsedPackageJson.name && parsedPackageJson.version) {
              if (isNestedPackageName(parsedPackageJson.name, packageName)) {
                this.packageJsonResolutionCache.set(candidatePath, null);
              } else {
                this.packageJsonResolutionCache.set(
                  candidatePath,
                  parsedPackageJson
                );
                return parsedPackageJson;
              }
            } else {
              // A module-format stub without name/version: remember it and keep
              // traversing towards the real manifest.
              this.packageJsonResolutionCache.set(candidatePath, null);
            }
          } catch {
            // Package.json is invalid, keep traversing
          }
        }
        dir = dirname(dir);
      }
      return null;
    } catch {
      return null;
    }
  }

  // Importers in many directories reach one manifest, read once per build
  private readNodeModulesWalkManifest(
    packageJsonPath: string
  ): PackageJson | null {
    let manifest = this.nodeModulesWalkManifestsByPath.get(packageJsonPath);
    if (manifest === undefined) {
      try {
        const parsedPackageJson = readJsonFile(packageJsonPath);
        manifest =
          parsedPackageJson.name && parsedPackageJson.version
            ? parsedPackageJson
            : null;
      } catch {
        manifest = null;
      }
      this.nodeModulesWalkManifestsByPath.set(packageJsonPath, manifest);
    }
    return manifest;
  }

  private realPath(path: string): string {
    let realPath = this.realPaths.get(path);
    if (realPath === undefined) {
      realPath = realpathSync(path);
      this.realPaths.set(path, realPath);
    }
    return realPath;
  }

  private readCompletePackageJson(
    packageJsonPath: string | null
  ): PackageJson | null {
    if (!packageJsonPath) {
      return null;
    }
    const cached = this.packageJsonResolutionCache.get(packageJsonPath);
    if (cached?.name && cached.version) {
      return cached;
    }
    try {
      const parsedPackageJson = readJsonFile(packageJsonPath);
      if (parsedPackageJson.name && parsedPackageJson.version) {
        this.packageJsonResolutionCache.set(packageJsonPath, parsedPackageJson);
        return parsedPackageJson;
      }
      this.packageJsonResolutionCache.set(packageJsonPath, null);
      return null;
    } catch {
      return null;
    }
  }
}

// A link counts even when its target is missing
function hasEntry(path: string): boolean {
  try {
    return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
  } catch {
    return false;
  }
}

// Where a chain of links ends when its last target doesn't exist, in the
// canonical form `realpathSync` gives once it does
function resolveDanglingLink(path: string): string | undefined {
  try {
    if (!lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) {
      return undefined;
    }
    let link = path;
    let target = path;
    for (let hops = 0; hops < 40; hops++) {
      target = join(
        resolve(realpathSync(dirname(link)), readlinkSync(link)),
        relative(link, target)
      );
      // The target can be missing because a link above it dangles
      link = target;
      while (!lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) {
        if (existsSync(link)) {
          return join(realpathSync(link), relative(link, target));
        }
        // A missing Windows drive or share is its own parent
        if (dirname(link) === link) {
          return undefined;
        }
        link = dirname(link);
      }
    }
  } catch {}
  return undefined;
}
