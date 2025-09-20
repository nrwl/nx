import { isBuiltin } from 'node:module';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { clean, satisfies } from 'semver';
import type {
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import {
  createProjectRootMappings,
  findProjectForPath,
} from '../../../../project-graph/utils/find-project-for-path';
import { isRelativePath, readJsonFile } from '../../../../utils/fileutils';
import { getPackageNameFromImportPath } from '../../../../utils/get-package-name-from-import-path';
import type { PackageJson } from '../../../../utils/package-json';
import { workspaceRoot } from '../../../../utils/workspace-root';
import {
  getWorkspacePackagesMetadata,
  matchImportToWildcardEntryPointsToProjectMap,
} from '../../utils/packages';
import { resolveRelativeToDir } from '../../utils/resolve-relative-to-dir';
import {
  getRootTsConfigFileName,
  resolveModuleByImport,
} from '../../utils/typescript';

/**
 * The key is a combination of the package name and the workspace relative directory
 * containing the file importing it e.g. `lodash__packages/my-lib`, the value is the
 * resolved external node name from the project graph.
 */
type NpmResolutionCache = Map<string, string | null>;

type PathPattern = {
  pattern: string;
  prefix: string;
  suffix: string;
};
type ParsedPatterns = {
  matchableStrings: Set<string> | undefined;
  patterns: PathPattern[] | undefined;
};

/**
 * Use a shared cache to avoid repeated npm package resolution work within the TargetProjectLocator.
 */
const defaultNpmResolutionCache: NpmResolutionCache = new Map();

const experimentalNodeModules = new Set(['node:sqlite']);

export function isBuiltinModuleImport(importExpr: string): boolean {
  const packageName = getPackageNameFromImportPath(importExpr);
  return isBuiltin(packageName) || experimentalNodeModules.has(packageName);
}

export class TargetProjectLocator {
  private projectRootMappings = createProjectRootMappings(this.nodes);
  private npmProjects: Record<string, ProjectGraphExternalNode | null>;
  private tsConfig = this.getRootTsConfig();
  private paths = this.tsConfig.config?.compilerOptions?.paths;
  private parsedPathPatterns: ParsedPatterns | undefined;
  private typescriptResolutionCache = new Map<string, string | null>();
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
    private readonly npmResolutionCache: NpmResolutionCache = defaultNpmResolutionCache
  ) {
    /**
     * Only the npm external nodes should be included.
     *
     * Unlike the raw externalNodes, ensure that there is always copy of the node where the version
     * is set in the key for optimal lookup.
     */
    this.npmProjects = Object.values(this.externalNodes).reduce((acc, node) => {
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
    }, {} as Record<string, ProjectGraphExternalNode>);

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
        const path = matchedStar ? p.replace('*', matchedStar) : p;
        const maybeResolvedProject = this.findProjectOfResolvedModule(path);
        if (maybeResolvedProject) {
          return maybeResolvedProject;
        }
      }
    }

    if (isBuiltinModuleImport(importExpr)) {
      this.npmResolutionCache.set(importExpr, null);
      return null;
    }

    // try to find npm package before using expensive typescript resolution
    const externalProject = this.findNpmProjectFromImport(importExpr, filePath);
    if (externalProject) {
      return externalProject;
    }

    if (this.tsConfig.config) {
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

    try {
      const resolvedModule = this.resolveImportWithRequire(
        importExpr,
        filePath
      );

      return this.findProjectOfResolvedModule(resolvedModule);
    } catch {}

    // fall back to see if it's a locally linked workspace project where the
    // output might not exist yet
    const localProject = this.findImportInWorkspaceProjects(importExpr);
    if (localProject) {
      return localProject;
    }

    // nothing found, cache for later
    this.npmResolutionCache.set(importExpr, null);
    return null;
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
    const packageName = getPackageNameFromImportPath(importExpr);

    let fullFilePath = fromFilePath;
    let workspaceRelativeFilePath = fromFilePath;
    if (fromFilePath.startsWith(workspaceRoot)) {
      workspaceRelativeFilePath = fromFilePath.replace(workspaceRoot, '');
    } else {
      fullFilePath = join(workspaceRoot, fromFilePath);
    }

    const fullDirPath = dirname(fullFilePath);
    const workspaceRelativeDirPath = dirname(workspaceRelativeFilePath);

    const npmImportForProject = `${packageName}__${workspaceRelativeDirPath}`;
    if (this.npmResolutionCache.has(npmImportForProject)) {
      return this.npmResolutionCache.get(npmImportForProject);
    }

    try {
      // package.json refers to an external package, we do not match against the version found in there, we instead try and resolve the relevant package how node would
      const externalPackageJson = this.readPackageJson(
        packageName,
        fullDirPath
      );
      // The external package.json path might be not be resolvable, e.g. if a reference has been added to a project package.json, but the install command has not been run yet.
      if (!externalPackageJson) {
        // Try and fall back to resolving an external node from the graph by name
        const externalNode = this.npmProjects[`npm:${packageName}`];
        const externalNodeName = externalNode?.name || null;
        this.npmResolutionCache.set(npmImportForProject, externalNodeName);
        return externalNodeName;
      }

      const version = clean(externalPackageJson.version);
      let matchingExternalNode =
        this.npmProjects[`npm:${externalPackageJson.name}@${version}`];

      if (!matchingExternalNode) {
        // check if it's a package alias, where the resolved package key is used as the version
        const aliasNpmProjectKey = `npm:${packageName}@npm:${externalPackageJson.name}@${version}`;
        matchingExternalNode = this.npmProjects[aliasNpmProjectKey];
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

      this.npmResolutionCache.set(
        npmImportForProject,
        matchingExternalNode.name
      );
      return matchingExternalNode.name;
    } catch (e) {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.error(e);
      }
      return null;
    }
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

    if (this.packagesMetadata.entryPointsToProjectMap[importPath]) {
      return this.packagesMetadata.entryPointsToProjectMap[importPath].name;
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

    if (!maybeDepMetadata?.isInPackageManagerWorkspaces) {
      return null;
    }

    const normalizedRange = packageVersion.replace('workspace:', '');

    if (normalizedRange === '*') {
      return maybeDep?.name;
    }

    if (normalizedRange.startsWith('file:')) {
      const targetPath = maybeDep?.data.root;

      const normalizedPath = normalizedRange.replace('file:', '');
      const resolvedPath = join(dirname(packageJsonPath), normalizedPath);

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
    if (
      resolvedModule.startsWith('node_modules/') ||
      resolvedModule.includes('/node_modules/')
    ) {
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
   */
  private readPackageJson(
    packageName: string,
    relativeToDir: string
  ): PackageJson | null {
    // The package.json is directly resolvable
    const packageJsonPath = resolveRelativeToDir(
      join(packageName, 'package.json'),
      relativeToDir
    );
    if (packageJsonPath) {
      const parsedPackageJson = readJsonFile(packageJsonPath);

      if (parsedPackageJson.name && parsedPackageJson.version) {
        return parsedPackageJson;
      }
    }

    try {
      // Resolve the main entry point of the package
      const pathOfFileInPackage =
        packageJsonPath ?? resolveRelativeToDir(packageName, relativeToDir);
      let dir = dirname(pathOfFileInPackage);

      while (dir !== dirname(dir)) {
        const packageJsonPath = join(dir, 'package.json');
        try {
          const parsedPackageJson = readJsonFile(packageJsonPath);
          // Ensure the package.json contains the "name" and "version" fields
          if (parsedPackageJson.name && parsedPackageJson.version) {
            return parsedPackageJson;
          }
        } catch {
          // Package.json doesn't exist, keep traversing
        }
        dir = dirname(dir);
      }
      return null;
    } catch {
      return null;
    }
  }
}
