import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNodeRecords,
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import { TargetProjectLocator } from '../../target-project-locator';

export function buildExplicitTypeScriptDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency,
  fileRead: (s: string) => string
) {
  const importLocator = new TypeScriptImportLocator(fileRead);
  const targetProjectLocator = new TargetProjectLocator(nodes);
  Object.keys(ctx.fileMap).forEach((source) => {
    Object.values(ctx.fileMap[source]).forEach((f) => {
      importLocator.fromFile(
        f.file,
        (importExpr: string, filePath: string, type: DependencyType) => {
          const target = targetProjectLocator.findProjectWithImport(
            importExpr,
            f.file,
            ctx.nxJson.npmScope
          );
          if (source && target) {
            addDependency(type, source, target);
          }
        }
      );
    });
  });
}
