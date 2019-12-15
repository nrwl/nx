import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNodeRecords
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import { normalizedProjectRoot } from '../../file-utils';

export function buildExplicitTypeScriptDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency,
  fileRead: (s: string) => string
) {
  const importLocator = new TypeScriptImportLocator(fileRead);

  Object.keys(ctx.fileMap).forEach(source => {
    Object.values(ctx.fileMap[source]).forEach(f => {
      importLocator.fromFile(
        f.file,
        (importExpr: string, filePath: string, type: DependencyType) => {
          const target = findTargetProject(importExpr, nodes);
          if (source && target) {
            addDependency(type, source, target);
          }
        }
      );
    });
  });

  function findTargetProject(importExpr, nodes) {
    return Object.keys(nodes).find(projectName => {
      const p = nodes[projectName];
      const normalizedRoot = normalizedProjectRoot(p);
      return (
        importExpr === `@${ctx.nxJson.npmScope}/${normalizedRoot}` ||
        importExpr.startsWith(`@${ctx.nxJson.npmScope}/${normalizedRoot}#`) ||
        importExpr.startsWith(`@${ctx.nxJson.npmScope}/${normalizedRoot}/`)
      );
    });
  }
}
