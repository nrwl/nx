import { TypeScriptImportLocator } from './typescript-import-locator';
import { TargetProjectLocator } from '../../utils/target-project-locator';
import {
  DependencyType,
  ProjectFileMap,
  ProjectGraph,
} from '../../config/project-graph';
import { Workspace } from '../../config/workspace-config-project-config';

export function buildExplicitTypeScriptDependencies(
  workspace: Workspace,
  graph: ProjectGraph,
  filesToProcess: ProjectFileMap
) {
  function isRoot(projectName: string) {
    return graph.nodes[projectName]?.data?.root === '.';
  }

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
            f.file
          );
          if (target) {
            if (!isRoot(source) && isRoot(target)) {
              // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
              return;
            }

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
