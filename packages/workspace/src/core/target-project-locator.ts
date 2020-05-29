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
