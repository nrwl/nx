import { DependencyType } from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import { TargetProjectLocator } from '../../target-project-locator';
import {
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';

export function buildExplicitTypeScriptDependencies(
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  const importLocator = new TypeScriptImportLocator();
  const targetProjectLocator = new TargetProjectLocator(builder.graph.nodes);
  Object.keys(ctx.filesToProcess).forEach((source) => {
    Object.values(ctx.filesToProcess[source]).forEach((f) => {
      importLocator.fromFile(
        f.file,
        (importExpr: string, filePath: string, type: DependencyType) => {
          const target = targetProjectLocator.findProjectWithImport(
            importExpr,
            f.file,
            ctx.workspace.npmScope
          );
          if (source && target) {
            builder.addExplicitDependency(source, f.file, target);
          }
        }
      );
    });
  });
}
