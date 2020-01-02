import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNodeRecords
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import { findTargetProjectWithImport } from './find-target-project';

export function buildExplicitTypeScriptDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  nodeNames: string[],
  addDependency: AddProjectDependency,
  fileRead: (s: string) => string
) {
  const importLocator = new TypeScriptImportLocator(fileRead);

  Object.keys(ctx.fileMap).forEach(source => {
    Object.values(ctx.fileMap[source]).forEach(f => {
      importLocator.fromFile(
        f.file,
        (importExpr: string, filePath: string, type: DependencyType) => {
          const target = findTargetProjectWithImport(
            importExpr,
            f.file,
            ctx.nxJson.npmScope,
            nodes,
            nodeNames
          );
          if (source && target) {
            addDependency(type, source, target);
          }
        }
      );
    });
  });
}
