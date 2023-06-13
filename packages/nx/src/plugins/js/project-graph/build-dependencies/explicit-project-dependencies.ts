import { TypeScriptImportLocator } from './typescript-import-locator';
import { TargetProjectLocator } from './target-project-locator';
import { findImports } from '../../../../native';
import {
  DependencyType,
  ProjectFileMap,
  ProjectGraph,
} from '../../../../config/project-graph';

export type ExplicitDependency = {
  sourceProjectName: string;
  targetProjectName: string;
  sourceProjectFile: string;
  type?: DependencyType.static | DependencyType.dynamic;
};

export function buildExplicitTypeScriptDependencies(
  graph: ProjectGraph,
  filesToProcess: ProjectFileMap
): ExplicitDependency[] {
  let results: ExplicitDependency[];
  if (process.env.NX_SWC_IMPORT_LOCATOR) {
    results = buildExplicitTypeScriptDependenciesWithSwc(filesToProcess, graph);
  } else {
    results = buildExplicitTypeScriptDependenciesWithTs(filesToProcess, graph);
  }
  return results;
}

function isRoot(graph: ProjectGraph, projectName: string): boolean {
  return graph.nodes[projectName]?.data?.root === '.';
}

function buildExplicitTypeScriptDependenciesWithSwc(
  filesToProcess: ProjectFileMap,
  graph: ProjectGraph
): ExplicitDependency[] {
  const targetProjectLocator = new TargetProjectLocator(
    graph.nodes as any,
    graph.externalNodes
  );
  const res: ExplicitDependency[] = [];

  Object.keys(filesToProcess).forEach((source) => {
    const files = filesToProcess[source];
    findImports(
      files.map((f) => f.file),
      (_, { file, importExpr }) => {
        const target = targetProjectLocator.findProjectWithImport(
          importExpr,
          file
        );
        let targetProjectName;
        if (target) {
          if (!isRoot(graph, source) && isRoot(graph, target)) {
            // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
            return;
          }

          targetProjectName = target;
        } else {
          // treat all unknowns as npm packages, they can be eiher
          // - mistyped local import, which has to be fixed manually
          // - node internals, which should still be tracked as a dependency
          // - npm packages, which are not yet installed but should be tracked
          targetProjectName = `npm:${importExpr}`;
        }

        res.push({
          sourceProjectName: source,
          targetProjectName,
          sourceProjectFile: file,
          type: DependencyType.static,
        });
      }
    );
  });
  return res;
}

function buildExplicitTypeScriptDependenciesWithTs(
  filesToProcess: ProjectFileMap,
  graph: ProjectGraph
): ExplicitDependency[] {
  const importLocator = new TypeScriptImportLocator();
  const targetProjectLocator = new TargetProjectLocator(
    graph.nodes as any,
    graph.externalNodes
  );
  const res: ExplicitDependency[] = [];
  Object.keys(filesToProcess).forEach((source) => {
    Object.values(filesToProcess[source]).forEach((f) => {
      importLocator.fromFile(
        f.file,
        (
          importExpr: string,
          filePath: string,
          type: DependencyType.static | DependencyType.dynamic
        ) => {
          const target = targetProjectLocator.findProjectWithImport(
            importExpr,
            f.file
          );
          let targetProjectName;
          if (target) {
            if (!isRoot(graph, source) && isRoot(graph, target)) {
              // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
              return;
            }

            targetProjectName = target;
          } else {
            // treat all unknowns as npm packages, they can be eiher
            // - mistyped local import, which has to be fixed manually
            // - node internals, which should still be tracked as a dependency
            // - npm packages, which are not yet installed but should be tracked
            targetProjectName = `npm:${importExpr}`;
          }

          res.push({
            sourceProjectName: source,
            targetProjectName,
            sourceProjectFile: f.file,
            type,
          });
        }
      );
    });
  });
  return res;
}
