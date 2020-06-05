import { resolveModuleByImport } from '../utils/typescript';
import { normalizedProjectRoot } from './file-utils';
import { ProjectGraphNodeRecords } from './project-graph/project-graph-models';
import { getSortedProjectNodes, isWorkspaceProject } from './project-graph';

export class TargetProjectLocator {
  _sortedNodeNames = [];

  constructor(private nodes: ProjectGraphNodeRecords) {
    this._sortedNodeNames = getSortedProjectNodes(nodes).map(
      ({ name }) => name
    );
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
  ) {
    const normalizedImportExpr = importExpr.split('#')[0];

    const resolvedModule = resolveModuleByImport(
      normalizedImportExpr,
      filePath
    );

    return this._sortedNodeNames.find((projectName) => {
      const p = this.nodes[projectName];

      if (!isWorkspaceProject(p)) {
        return false;
      }

      if (resolvedModule && resolvedModule.startsWith(p.data.root)) {
        return true;
      } else {
        const normalizedRoot = normalizedProjectRoot(p);
        const projectImport = `@${npmScope}/${normalizedRoot}`;
        return normalizedImportExpr.startsWith(projectImport);
      }
    });
  }
}
