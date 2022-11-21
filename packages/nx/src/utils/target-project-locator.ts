import { getRootTsConfigFileName, resolveModuleByImport } from './typescript';
import { isRelativePath, readJsonFile } from './fileutils';
import { dirname, join, posix } from 'path';
import { workspaceRoot } from './workspace-root';
import {
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../config/project-graph';

export class TargetProjectLocator {
  private allProjectsFiles = createProjectFileMappings(this.nodes);
  private npmProjects = filterRootExternalDependencies(this.externalNodes);
  private tsConfig = this.getRootTsConfig();
  private paths = this.tsConfig.config?.compilerOptions?.paths;
  private typescriptResolutionCache = new Map<string, string | null>();
  private npmResolutionCache = new Map<string, string | null>();

  constructor(
    private readonly nodes: Record<string, ProjectGraphProjectNode>,
    private readonly externalNodes: Record<string, ProjectGraphExternalNode>
  ) {}

  /**
   * Find a project based on its import
   *
   * @param importExpr
   * @param filePath
   */
  findProjectWithImport(importExpr: string, filePath: string): string {
    const normalizedImportExpr = importExpr.split('#')[0];
    if (isRelativePath(normalizedImportExpr)) {
      const resolvedModule = posix.join(
        dirname(filePath),
        normalizedImportExpr
      );
      return this.findProjectOfResolvedModule(resolvedModule);
    }

    const paths = this.findPaths(normalizedImportExpr);
    if (paths) {
      for (let p of paths) {
        const maybeResolvedProject = this.findProjectOfResolvedModule(p);
        if (maybeResolvedProject) {
          return maybeResolvedProject;
        }
      }
    }

    // try to find npm package before using expensive typescript resolution
    const npmProject = this.findNpmPackage(normalizedImportExpr);
    if (npmProject) {
      return npmProject;
    }

    if (this.tsConfig.config) {
      // TODO(meeroslav): this block is probably obsolete
      // and existed only because of the incomplete `paths` matching
      // if import cannot be matched using tsconfig `paths` the compilation would fail anyway
      const resolvedProject = this.resolveImportWithTypescript(
        normalizedImportExpr,
        filePath
      );
      if (resolvedProject) {
        return resolvedProject;
      }
    }

    // nothing found, cache for later
    this.npmResolutionCache.set(normalizedImportExpr, undefined);
    return null;
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
      return this.paths[normalizedImportExpr];
    }
    const wildcardPath = Object.keys(this.paths).find(
      (path) =>
        path.endsWith('/*') &&
        (normalizedImportExpr.startsWith(path.replace(/\*$/, '')) ||
          normalizedImportExpr === path.replace(/\/\*$/, ''))
    );
    if (wildcardPath) {
      return this.paths[wildcardPath];
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

  private findNpmPackage(npmImport: string): string | undefined {
    if (this.npmResolutionCache.has(npmImport)) {
      return this.npmResolutionCache.get(npmImport);
    } else {
      const pkg = this.npmProjects.find(
        (pkg) =>
          npmImport === pkg.data.packageName ||
          npmImport.startsWith(`${pkg.data.packageName}/`)
      );
      if (pkg) {
        this.npmResolutionCache.set(npmImport, pkg.name);
        return pkg.name;
      }
    }
  }

  private findProjectOfResolvedModule(
    resolvedModule: string
  ): string | undefined {
    const normalizedResolvedModule = resolvedModule.startsWith('./')
      ? resolvedModule.substring(2)
      : resolvedModule;

    // for wildcard paths, we need to find file that starts with resolvedModule
    if (normalizedResolvedModule.endsWith('*')) {
      const matchingFile = Object.keys(this.allProjectsFiles).find((f) =>
        f.startsWith(normalizedResolvedModule.slice(0, -1))
      );
      return matchingFile && this.allProjectsFiles[matchingFile];
    }

    return (
      this.allProjectsFiles[normalizedResolvedModule] ||
      this.allProjectsFiles[`${normalizedResolvedModule}/index`]
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
    const project = this.allProjectsFiles[file];
    return project && this.nodes[project];
  }
}

// matches `npm:@scope/name`, `npm:name` but not `npm:@scope/name@version` and `npm:name@version`
const ROOT_VERSION_PACKAGE_NAME_REGEX = /^npm:(?!.+@.+)/;

function filterRootExternalDependencies(
  externalNodes: Record<string, ProjectGraphExternalNode>
): ProjectGraphExternalNode[] {
  if (!externalNodes) {
    return [];
  }
  const keys = Object.keys(externalNodes);
  const nodes = [];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].match(ROOT_VERSION_PACKAGE_NAME_REGEX)) {
      nodes.push(externalNodes[keys[i]]);
    }
  }
  return nodes;
}

/**
 * @deprecated This function will be removed in v16. Use {@link createProjectFileMappings} instead.
 *
 * Mapps the project root paths to the project name
 * @param nodes
 * @returns
 */
export function createProjectRootMappings(
  nodes: Record<string, ProjectGraphProjectNode>
): Map<string, string> {
  const projectRootMappings = new Map<string, string>();
  for (const projectName of Object.keys(nodes)) {
    const root = nodes[projectName].data.root;
    projectRootMappings.set(
      root && root.endsWith('/') ? root.substring(0, root.length - 1) : root,
      projectName
    );
  }
  return projectRootMappings;
}

/**
 * Strips the file extension from the file path
 * @param file
 * @returns
 */
export function removeExt(file: string): string {
  return file.replace(/(?<!(^|\/))\.[^/.]+$/, '');
}

/**
 * Maps the file paths to the project name, both with and without the file extension
 * apps/myapp/src/main.ts -> { 'apps/myapp/src/main': 'myapp', 'apps/myapp/src/main.ts': 'myapp' }
 * @param projectGraph
 * @returns
 */
export function createProjectFileMappings(
  nodes: Record<string, ProjectGraphProjectNode>
): Record<string, string> {
  const result: Record<string, string> = {};
  Object.entries(nodes).forEach(([name, node]) => {
    node.data.files.forEach(({ file }) => {
      const fileName = removeExt(file);
      result[fileName] = name;
      result[file] = name;
    });
  });

  return result;
}

/**
 * @deprecated This function will be removed in v16. Use {@link createProjectFileMappings} instead.
 *
 * Locates a project in projectRootMap based on a file within it
 * @param filePath path that is inside of projectName
 * @param projectRootMap Map<projectRoot, projectName>
 */
export function findMatchingProjectForPath(
  filePath: string,
  projectRootMap: Map<string, string>
): string | null {
  for (
    let currentPath = filePath;
    currentPath != dirname(currentPath);
    currentPath = dirname(currentPath)
  ) {
    const p = projectRootMap.get(currentPath);
    if (p) {
      return p;
    }
  }
  return null;
}
