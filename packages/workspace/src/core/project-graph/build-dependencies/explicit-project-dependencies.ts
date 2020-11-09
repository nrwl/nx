import {
  AddProjectDependency,
  DependencyType,
  ProjectGraphContext,
  ProjectGraphNodeRecords,
} from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import { TargetProjectLocator } from '../../target-project-locator';
import { FileRead } from '../../file-utils';

export function buildExplicitTypeScriptDependencies(
  ctx: ProjectGraphContext,
  nodes: ProjectGraphNodeRecords,
  addDependency: AddProjectDependency,
  fileRead: FileRead
) {
  const importLocator = new TypeScriptImportLocator(fileRead);
  const targetProjectLocator = new TargetProjectLocator(nodes, fileRead);
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
