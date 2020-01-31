import { resolveModuleByImport } from '../utils/typescript';
import { normalizedProjectRoot } from './file-utils';
import {
  ProjectGraphNodeRecords,
  ProjectType
} from './project-graph/project-graph-models';

export class TargetProjectLocator {
  _sortedNodeNames = [];

  constructor(private nodes: ProjectGraphNodeRecords) {
    this._sortedNodeNames = Object.keys(nodes).sort((a, b) => {
      // If a or b is not a nx project, leave them in the same spot
      if (
        !this._isNxProject(nodes[a].type) &&
        !this._isNxProject(nodes[b].type)
      ) {
        return 0;
      }
      // sort all non-projects lower
      if (
        !this._isNxProject(nodes[a].type) &&
        this._isNxProject(nodes[b].type)
      ) {
        return 1;
      }
      if (
        this._isNxProject(nodes[a].type) &&
        !this._isNxProject(nodes[b].type)
      ) {
        return -1;
      }

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

    return this._sortedNodeNames.find(projectName => {
      const p = this.nodes[projectName];

      if (!this._isNxProject(p.type)) {
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

  private _isNxProject(type: string) {
    return (
      type === ProjectType.app ||
      type === ProjectType.lib ||
      type === ProjectType.e2e
    );
  }
}
