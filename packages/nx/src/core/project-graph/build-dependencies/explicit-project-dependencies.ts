import { TypeScriptImportLocator } from './typescript-import-locator';
import { TargetProjectLocator } from '../../target-project-locator';
import {
  DependencyType,
  ProjectFileMap,
  ProjectGraph,
} from 'nx/src/shared/project-graph';
import { Workspace } from 'nx/src/shared/workspace';

export function buildExplicitTypeScriptDependencies(
  workspace: Workspace,
  graph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  const importLocator = new TypeScriptImportLocator();
  const targetProjectLocator = new TargetProjectLocator(
    graph.nodes as any,
    graph.externalNodes
  );
  const res = [] as any;
  Object.keys(filesToProcess).forEach((source) => {
    Object.values(filesToProcess[source]).forEach((f) => {
      importLocator.fromFile(
        f.file,
        (importExpr: string, filePath: string, type: DependencyType) => {
          const target = targetProjectLocator.findProjectWithImport(
            importExpr,
            f.file,
            workspace.npmScope
          );
          if (target) {
            res.push({
              sourceProjectName: source,
              targetProjectName: target,
              sourceProjectFile: f.file,
            });
          }
        }
      );
    });
  });
  return res;
}
