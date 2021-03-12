import { resolveModuleByImport } from '../utilities/typescript';
import { defaultFileRead, FileRead, normalizedProjectRoot } from './file-utils';
import {
  ProjectGraphNode,
  ProjectGraphNodeRecords,
} from './project-graph/project-graph-models';
import {
  getSortedProjectNodes,
  isNpmProject,
  isWorkspaceProject,
} from './project-graph';
import { isRelativePath, parseJsonWithComments } from '../utilities/fileutils';
import { dirname, join, posix } from 'path';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

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
  private tsConfigPath = this.getRootTsConfigPath();
  private absTsConfigPath = join(appRootPath, this.tsConfigPath);
  private paths = parseJsonWithComments(this.fileRead(this.tsConfigPath))
    ?.compilerOptions?.paths;
  private typescriptResolutionCache = new Map<string, string | null>();
  private npmResolutionCache = new Map<string, string | null>();

  constructor(
    private nodes: ProjectGraphNodeRecords,
    private fileRead: FileRead = defaultFileRead
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

    const npmProject = this.findNpmPackage(importExpr);
    if (npmProject) {
      return npmProject;
    }

    if (this.paths && this.paths[normalizedImportExpr]) {
      for (let p of this.paths[normalizedImportExpr]) {
        const maybeResolvedProject = this.findProjectOfResolvedModule(p);
        if (maybeResolvedProject) {
          return maybeResolvedProject;
        }
      }
    }

    const resolvedModule = this.typescriptResolutionCache.has(
      normalizedImportExpr
    )
      ? this.typescriptResolutionCache.get(normalizedImportExpr)
      : resolveModuleByImport(
          normalizedImportExpr,
          filePath,
          this.absTsConfigPath
        );

    this.typescriptResolutionCache.set(normalizedImportExpr, resolvedModule);
    if (resolvedModule) {
      const resolvedProject = this.findProjectOfResolvedModule(resolvedModule);

      if (resolvedProject) {
        return resolvedProject;
      }
    }

    const importedProject = this.sortedWorkspaceProjects.find((p) => {
      const projectImport = `@${npmScope}/${p.data.normalizedRoot}`;
      return normalizedImportExpr.startsWith(projectImport);
    });

    return importedProject?.name;
  }

  private findNpmPackage(npmImport: string) {
    if (this.npmResolutionCache.has(npmImport)) {
      return this.npmResolutionCache.get(npmImport);
    } else {
      const pkgName = this.npmProjects.find(
        (pkg) =>
          npmImport === pkg.data.packageName ||
          npmImport.startsWith(pkg.data.packageName + '/')
      )?.name;
      this.npmResolutionCache.set(npmImport, pkgName);
      return pkgName;
    }
  }

  private findProjectOfResolvedModule(resolvedModule: string) {
    const importedProject = this.sortedWorkspaceProjects.find((p) => {
      return resolvedModule.startsWith(p.data.root);
    });

    return importedProject?.name;
  }

  private getRootTsConfigPath() {
    try {
      this.fileRead('tsconfig.base.json');
      return 'tsconfig.base.json';
    } catch (e) {
      return 'tsconfig.json';
    }
  }
}
