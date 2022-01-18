import { DependencyType, ProjectGraph } from '../project-graph-models';
import { TypeScriptImportLocator } from './typescript-import-locator';
import { TargetProjectLocator } from '../../target-project-locator';
import {
  ProjectFileMap,
  ProjectGraphBuilderExplicitDependency,
  Workspace,
} from '@nrwl/devkit';

export function buildExplicitTypeScriptDependencies(
  workspace: Workspace,
  graph: ProjectGraph,
  filesToProcess: ProjectFileMap
): ProjectGraphBuilderExplicitDependency[] {
  const importLocator = new TypeScriptImportLocator();
  const targetProjectLocator = new TargetProjectLocator(
    graph.nodes,
    graph.externalNodes
  );
  const res: ProjectGraphBuilderExplicitDependency[] = [];
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
              dependencyType: type,
            });
          }
        }
      );
    });
  });
  return res;
}
