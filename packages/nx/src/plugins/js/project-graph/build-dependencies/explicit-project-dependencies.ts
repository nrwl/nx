import { TargetProjectLocator } from './target-project-locator';
import { DependencyType, ProjectGraph } from '../../../../config/project-graph';
import { join, relative } from 'path';
import { workspaceRoot } from '../../../../utils/workspace-root';
import { normalizePath } from '../../../../utils/path';
import { CreateDependenciesContext } from '../../../../utils/nx-plugin';
import {
  ProjectGraphDependencyWithFile,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';

function isRoot(graph: ProjectGraph, projectName: string): boolean {
  return graph.nodes[projectName]?.data?.root === '.';
}

function convertImportToDependency(
  importExpr: string,
  sourceFile: string,
  source: string,
  dependencyType: ProjectGraphDependencyWithFile['dependencyType'],
  targetProjectLocator: TargetProjectLocator
): ProjectGraphDependencyWithFile {
  const target =
    targetProjectLocator.findProjectWithImport(importExpr, sourceFile) ??
    `npm:${importExpr}`;

  return {
    source,
    target,
    sourceFile,
    dependencyType,
  };
}

export function buildExplicitTypeScriptDependencies({
  fileMap,
  graph,
}: CreateDependenciesContext): ProjectGraphDependencyWithFile[] {
  const targetProjectLocator = new TargetProjectLocator(
    graph.nodes as any,
    graph.externalNodes
  );
  const res: ProjectGraphDependencyWithFile[] = [];

  const filesToProcess: Record<string, string[]> = {};

  const moduleExtensions = ['.ts', '.js', '.tsx', '.jsx', '.mts', '.mjs'];

  for (const [project, fileData] of Object.entries(fileMap)) {
    filesToProcess[project] ??= [];
    for (const { file } of fileData) {
      if (moduleExtensions.some((ext) => file.endsWith(ext))) {
        filesToProcess[project].push(join(workspaceRoot, file));
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
    const normalizedFilePath = normalizePath(relative(workspaceRoot, file));
    for (const importExpr of staticImportExpressions) {
      const dependency = convertImportToDependency(
        importExpr,
        normalizedFilePath,
        sourceProject,
        DependencyType.static,
        targetProjectLocator
      );
      // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
      if (
        isRoot(graph, dependency.source) ||
        !isRoot(graph, dependency.target)
      ) {
        res.push(dependency);
      }
    }
    for (const importExpr of dynamicImportExpressions) {
      const dependency = convertImportToDependency(
        importExpr,
        normalizedFilePath,
        sourceProject,
        DependencyType.dynamic,
        targetProjectLocator
      );
      // TODO: These edges technically should be allowed but we need to figure out how to separate config files out from root
      if (
        isRoot(graph, dependency.source) ||
        !isRoot(graph, dependency.target)
      ) {
        validateDependency(graph, dependency);
        res.push(dependency);
      }
    }
  }

  return res;
}
