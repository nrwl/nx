import { TypeScriptImportLocator } from './typescript-import-locator';
import { TargetProjectLocator } from './target-project-locator';
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
  if (
    process.env.NX_NATIVE_TS_DEPS &&
    process.env.NX_NATIVE_TS_DEPS !== 'false'
  ) {
    results = buildExplicitTypeScriptDependenciesWithSwc(filesToProcess, graph);
  } else {
    results = buildExplicitTypeScriptDependenciesWithTs(filesToProcess, graph);
  }
  if (
    process.env.NX_NATIVE_TS_DEPS &&
    process.env.NX_NATIVE_TS_DEPS === 'debug'
  ) {
    const tsResults = buildExplicitTypeScriptDependenciesWithTs(
      filesToProcess,
      graph
    );

    const set = new Set<string>();

    for (const dep of results) {
      set.add(
        `+ ${dep.sourceProjectName} -> ${dep.targetProjectName} (${dep.sourceProjectFile})`
      );
    }
    for (const dep of tsResults) {
      set.delete(
        `+ ${dep.sourceProjectName} -> ${dep.targetProjectName} (${dep.sourceProjectFile})`
      );
      set.add(
        `- ${dep.sourceProjectName} -> ${dep.targetProjectName} (${dep.sourceProjectFile})`
      );
    }
    for (const dep of results) {
      set.delete(
        `- ${dep.sourceProjectName} -> ${dep.targetProjectName} (${dep.sourceProjectFile})`
      );
    }
    set.forEach((s) => console.log(s));
  }
  return results;
}

function isRoot(graph: ProjectGraph, projectName: string): boolean {
  return graph.nodes[projectName]?.data?.root === '.';
}

function convertImportToDependency(
  importExpr: string,
  file: string,
  sourceProject: string,
  type: ExplicitDependency['type'],
  targetProjectLocator: TargetProjectLocator
): ExplicitDependency {
  const target = targetProjectLocator.findProjectWithImport(importExpr, file);
  let targetProjectName;
  if (target) {
    targetProjectName = target;
  } else {
    // treat all unknowns as npm packages, they can be eiher
    // - mistyped local import, which has to be fixed manually
    // - node internals, which should still be tracked as a dependency
    // - npm packages, which are not yet installed but should be tracked
    targetProjectName = `npm:${importExpr}`;
  }

  return {
    sourceProjectName: sourceProject,
    targetProjectName,
    sourceProjectFile: file,
    type,
  };
}

function buildExplicitTypeScriptDependenciesWithSwc(
  projectFileMap: ProjectFileMap,
  graph: ProjectGraph
): ExplicitDependency[] {
  const targetProjectLocator = new TargetProjectLocator(
    graph.nodes as any,
    graph.externalNodes
  );
  const res: ExplicitDependency[] = [];

  const filesToProcess: Record<string, string[]> = {};

  const moduleExtensions = ['.ts', '.js', '.tsx', '.jsx', '.mts', '.mjs'];

  for (const [project, fileData] of Object.entries(projectFileMap)) {
    filesToProcess[project] ??= [];
    for (const { file } of fileData) {
      if (moduleExtensions.some((ext) => file.endsWith(ext))) {
        filesToProcess[project].push(file);
      }
    }
  }

  const { findImports } = require('../../../../native');

  const imports = findImports(filesToProcess);

  for (const {
    sourceProject,
    file,
    staticImportExpressions,
    dynamicImportExpressions,
  } of imports) {
    for (const importExpr of staticImportExpressions) {
      const dependency = convertImportToDependency(
        importExpr,
        file,
        sourceProject,
        DependencyType.static,
        targetProjectLocator
      );
      // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
      if (
        isRoot(graph, dependency.sourceProjectName) ||
        !isRoot(graph, dependency.targetProjectName)
      ) {
        res.push(dependency);
      }
    }
    for (const importExpr of dynamicImportExpressions) {
      const dependency = convertImportToDependency(
        importExpr,
        file,
        sourceProject,
        DependencyType.dynamic,
        targetProjectLocator
      );
      // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
      if (
        isRoot(graph, dependency.sourceProjectName) ||
        !isRoot(graph, dependency.targetProjectName)
      ) {
        res.push(dependency);
      }
    }
  }

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
