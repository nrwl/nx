import { isBuiltin } from 'node:module';
import { dirname, join, posix, relative } from 'node:path';
import { clean } from 'semver';
import {
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import {
  createProjectRootMappings,
  findProjectForPath,
} from '../../../../project-graph/utils/find-project-for-path';
import { isRelativePath, readJsonFile } from '../../../../utils/fileutils';
import { PackageJson } from '../../../../utils/package-json';
import { workspaceRoot } from '../../../../utils/workspace-root';
import { resolveRelativeToDir } from '../../utils/resolve-relative-to-dir';
import {
  getRootTsConfigFileName,
  resolveModuleByImport,
} from '../../utils/typescript';
import { getPackageNameFromImportPath } from '../../../../utils/get-package-name-from-import-path';

/**
 * The key is a combination of the package name and the workspace relative directory
 * containing the file importing it e.g. `lodash__packages/my-lib`, the value is the
 * resolved external node name from the project graph.
 */
type NpmResolutionCache = Map<string, string | null>;

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
  private typescriptResolutionCache = new Map<string, string | null>();

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
    const results = this.findPaths(importExpr);
    if (results) {
      const [path, paths] = results;
      for (let p of paths) {
        const r = p.endsWith('/*')
          ? join(dirname(p), relative(path.replace(/\*$/, ''), importExpr))
          : p;
        const maybeResolvedProject = this.findProjectOfResolvedModule(r);
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
      // TODO(meeroslav): this block is probably obsolete
      // and existed only because of the incomplete `paths` matching
      // if import cannot be matched using tsconfig `paths` the compilation would fail anyway
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
   * @returns
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

  private resolveImportWithTypescript(
    normalizedImportExpr: string,
    filePath: string
  ): string | undefined {
    let resolvedModule: string;
    if (this.typescriptResolutionCache.has(normalizedImportExpr)) {
      resolvedModule = this.typescriptResolutionCache.get(normalizedImportExpr);
    } else {
      resolvedModule = resolveModuleByImport(
        normalizedImportExpr,
        filePath,
        this.tsConfig.absolutePath
      );
      this.typescriptResolutionCache.set(
        normalizedImportExpr,
        resolvedModule ? resolvedModule : null
      );
    }

    // TODO: vsavkin temporary workaround. Remove it once we reworking handling of npm packages.
    if (resolvedModule && resolvedModule.indexOf('node_modules/') === -1) {
      const resolvedProject = this.findProjectOfResolvedModule(resolvedModule);
      if (resolvedProject) {
        return resolvedProject;
      }
    }
    return;
  }

  private resolveImportWithRequire(
    normalizedImportExpr: string,
    filePath: string
  ) {
    return posix.relative(
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
    const normalizedResolvedModule = resolvedModule.startsWith('./')
      ? resolvedModule.substring(2)
      : resolvedModule;
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
