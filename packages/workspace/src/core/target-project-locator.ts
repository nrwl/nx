import { resolveModuleByImport } from '../utilities/typescript';
import { normalizedProjectRoot, readFileIfExisting } from './file-utils';
import type { ProjectGraphNode } from '@nrwl/devkit';
import { parseJson, ProjectGraphExternalNode } from '@nrwl/devkit';
import { isRelativePath } from '../utilities/fileutils';
import { dirname, join, posix } from 'path';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { getSortedProjectNodes } from './project-graph';

export class TargetProjectLocator {
  private sortedProjects = getSortedProjectNodes(this.nodes);

  private sortedWorkspaceProjects = this.sortedProjects.map(
    (node) =>
      ({
        ...node,
        data: {
          ...node.data,
          normalizedRoot: normalizedProjectRoot(node),
        },
      } as ProjectGraphNode)
  );
  private npmProjects = this.externalNodes
    ? Object.values(this.externalNodes)
    : [];
  private tsConfig = this.getRootTsConfig();
  private paths = this.tsConfig.config?.compilerOptions?.paths;
  private typescriptResolutionCache = new Map<string, string | null>();
  private npmResolutionCache = new Map<string, string | null>();

  constructor(
    private readonly nodes: Record<string, ProjectGraphNode>,
    private readonly externalNodes: Record<string, ProjectGraphExternalNode>
  ) {}

  /**
   * Find a project based on its import
   *
   * @param importExpr
   * @param filePath
   * @param npmScope
   *  Npm scope shouldn't be used finding a project, but, to improve backward
   *  compatibility, we fallback to checking the scope.
   *  This happens in cases where someone has the dist output in their tsconfigs
   *  and typescript will find the dist before the src.
   */
  findProjectWithImport(
    importExpr: string,
    filePath: string,
    npmScope: string
  ): string {
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

    // TODO(meeroslav): this block should be removed as it's going around typescript paths
    // unless we want to support local JS projects
    const importedProject = this.sortedWorkspaceProjects.find((p) => {
      const projectImport = `@${npmScope}/${p.data.normalizedRoot}`;
      return (
        normalizedImportExpr === projectImport ||
        normalizedImportExpr.startsWith(`${projectImport}/`)
      );
    });
    if (importedProject) {
      return importedProject.name;
    }

    // nothing found, cache for later
    this.npmResolutionCache.set(normalizedImportExpr, undefined);
    return null;
  }

  private findPaths(normalizedImportExpr: string): string[] | undefined {
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
    const normalizedModulePath = this.getAbsolutePath(resolvedModule);
    const importedProject = this.sortedWorkspaceProjects.find((p) => {
      return normalizedModulePath.startsWith(this.getAbsolutePath(p.data.root));
    });

    return importedProject ? importedProject.name : void 0;
  }

  private getAbsolutePath(path: string) {
    return join(appRootPath, path);
  }

  private getRootTsConfig() {
    let path = 'tsconfig.base.json';
    let absolutePath = this.getAbsolutePath(path);
    let content = readFileIfExisting(absolutePath);
    if (!content) {
      path = 'tsconfig.json';
      absolutePath = this.getAbsolutePath(path);
      content = readFileIfExisting(absolutePath);
    }
    return { path, absolutePath, config: parseJson(content) };
  }
}
