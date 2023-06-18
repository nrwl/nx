import {
  getRootTsConfigFileName,
  resolveModuleByImport,
} from '../../utils/typescript';
import { isRelativePath, readJsonFile } from '../../../../utils/fileutils';
import { dirname, join, posix } from 'path';
import { workspaceRoot } from '../../../../utils/workspace-root';
import {
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { builtinModules } from 'module';
import {
  createProjectRootMappings,
  findProjectForPath,
} from '../../../../project-graph/utils/find-project-for-path';

const builtInModuleSet = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((x) => `node:${x}`),
]);

export class TargetProjectLocator {
  private projectRootMappings = createProjectRootMappings(this.nodes);
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

    // find project using tsconfig paths
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

    if (builtInModuleSet.has(normalizedImportExpr)) {
      this.npmResolutionCache.set(normalizedImportExpr, null);
      return null;
    }

    try {
      const resolvedModule = this.resolveImportWithRequire(
        normalizedImportExpr,
        filePath
      );

      return this.findProjectOfResolvedModule(resolvedModule);
    } catch {}

    // nothing found, cache for later
    this.npmResolutionCache.set(normalizedImportExpr, null);
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
