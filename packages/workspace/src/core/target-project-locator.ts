import { resolveModuleByImport } from '../utilities/typescript';
import { normalizedProjectRoot, readFileIfExisting } from './file-utils';
import type { ProjectGraphNode } from '@nrwl/devkit';
import { parseJson } from '@nrwl/devkit';
import {
  getSortedProjectNodes,
  isNpmProject,
  isWorkspaceProject,
} from './project-graph';
import { isRelativePath } from '../utilities/fileutils';
import { dirname, join, posix } from 'path';
import { appRootPath } from '../utilities/app-root';

export class TargetProjectLocator {
  private sortedProjects = getSortedProjectNodes(this.nodes);

  private sortedWorkspaceProjects = this.sortedProjects
    .filter(isWorkspaceProject)
    .map(
      (node) =>
        ({
          ...node,
          data: {
            ...node.data,
            normalizedRoot: normalizedProjectRoot(node),
          },
        } as ProjectGraphNode)
    );
  private npmProjects = this.sortedProjects.filter(isNpmProject);
  private tsConfig = this.getRootTsConfig();
  private paths = this.tsConfig.config?.compilerOptions?.paths;
  private typescriptResolutionCache = new Map<string, string | null>();
  private npmResolutionCache = new Map<string, string | null>();

  constructor(private readonly nodes: Record<string, ProjectGraphNode>) {}

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

    if (this.paths && this.paths[normalizedImportExpr]) {
      for (let p of this.paths[normalizedImportExpr]) {
        const maybeResolvedProject = this.findProjectOfResolvedModule(p);
        if (maybeResolvedProject) {
          return maybeResolvedProject;
        }
      }
    }

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

    // try to find npm package before using expensive typescript resolution
    const npmProject = this.findNpmPackage(importExpr);
    if (npmProject || this.npmResolutionCache.has(importExpr)) {
      return npmProject;
    }

    // TODO: meeroslav this block should be probably removed
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
    this.npmResolutionCache.set(importExpr, undefined);
    return null;
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

  private findProjectOfResolvedModule(resolvedModule: string) {
    const importedProject = this.sortedWorkspaceProjects.find((p) => {
      return resolvedModule.startsWith(p.data.root);
    });

    return importedProject ? importedProject.name : void 0;
  }

  private getRootTsConfig() {
    let path = 'tsconfig.base.json';
    let absolutePath = join(appRootPath, path);
    let content = readFileIfExisting(absolutePath);
    if (!content) {
      path = 'tsconfig.json';
      absolutePath = join(appRootPath, path);
      content = readFileIfExisting(absolutePath);
    }
    return { path, absolutePath, config: parseJson(content) };
  }
}
