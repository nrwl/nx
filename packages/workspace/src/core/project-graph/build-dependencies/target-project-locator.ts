import { resolveModuleByImport } from '../../../utils/typescript';
import { normalizedProjectRoot } from '../../file-utils';
import { ProjectGraphNodeRecords } from '../project-graph-models';

export class TargetProjectLocator {
  private sortedNodeNames = [];

  constructor(private nodes: ProjectGraphNodeRecords) {
    this.sortedNodeNames = Object.keys(nodes).sort((a, b) => {
      if (!nodes[a].data.root) return -1;
      if (!nodes[b].data.root) return -1;
      return nodes[a].data.root.length > nodes[b].data.root.length ? -1 : 1;
    });
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

    return this.sortedNodeNames.find(projectName => {
      const p = this.nodes[projectName];

      // If there is no root in the data object, it's not a nx project (ie. npm module)
      if (!p.data.root) {
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
