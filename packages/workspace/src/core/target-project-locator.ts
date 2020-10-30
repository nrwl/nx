import { resolveModuleByImport } from '../utils/typescript';
import { defaultFileRead, normalizedProjectRoot } from './file-utils';
import { ProjectGraphNodeRecords } from './project-graph/project-graph-models';
import { getSortedProjectNodes, isWorkspaceProject } from './project-graph';
import { isRelativePath, parseJsonWithComments } from '../utils/fileutils';
import { dirname, join } from 'path';

export class TargetProjectLocator {
  private sortedWorkspaceProjects = [];
  private paths = parseJsonWithComments(this.fileRead(`./tsconfig.json`))
    ?.compilerOptions?.paths;
  private cache = new Map<string, string>();

  constructor(
    private nodes: ProjectGraphNodeRecords,
    private fileRead: (path: string) => string = defaultFileRead
  ) {
    this.sortedWorkspaceProjects = getSortedProjectNodes(nodes)
      .filter((node) => isWorkspaceProject(node))
      .map((node) => ({
        ...node,
        data: {
          ...node.data,
          normalizedRoot: normalizedProjectRoot(node),
        },
      }));
  }

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
      const resolvedModule = join(dirname(filePath), normalizedImportExpr);
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

    const resolvedModule = this.cache.has(normalizedImportExpr)
      ? this.cache.get(normalizedImportExpr)
      : resolveModuleByImport(normalizedImportExpr, filePath);

    this.cache.set(normalizedImportExpr, resolvedModule);
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

  private findProjectOfResolvedModule(resolvedModule: string) {
    const importedProject = this.sortedWorkspaceProjects.find((p) => {
      return resolvedModule.startsWith(p.data.root);
    });

    return importedProject?.name;
  }
}
