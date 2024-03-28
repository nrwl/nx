import { TargetProjectLocator } from './target-project-locator';
import {
  DependencyType,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { join, relative } from 'path';
import { workspaceRoot } from '../../../../utils/workspace-root';
import { normalizePath } from '../../../../utils/path';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';
import { ProjectConfiguration } from '../../../../config/workspace-json-project-json';

function isRoot(
  projects: Record<string, ProjectConfiguration>,
  projectName: string
): boolean {
  return projects[projectName]?.root === '.';
}

function convertImportToDependency(
  importExpr: string,
  sourceFile: string,
  source: string,
  type: RawProjectGraphDependency['type'],
  targetProjectLocator: TargetProjectLocator
): RawProjectGraphDependency {
  const target =
    targetProjectLocator.findProjectWithImport(importExpr, sourceFile) ??
    `npm:${importExpr}`;

  return {
    source,
    target,
    sourceFile,
    type,
  };
}

export function buildExplicitTypeScriptDependencies(
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  // TODO: TargetProjectLocator is a public API, so we can't change the shape of it
  // We should eventually let it accept Record<string, ProjectConfiguration> s.t. we
  // don't have to reshape the CreateDependenciesContext here.
  const nodes: Record<string, ProjectGraphProjectNode> = Object.fromEntries(
    Object.entries(ctx.projects).map(([key, config]) => [
      key,
      {
        name: key,
        type: null,
        data: config,
      },
    ])
  );
  const targetProjectLocator = new TargetProjectLocator(
    nodes,
    ctx.externalNodes
  );
  const res: RawProjectGraphDependency[] = [];

  const filesToProcess: Record<string, string[]> = {};

  const moduleExtensions = [
    '.ts',
    '.js',
    '.tsx',
    '.jsx',
    '.mts',
    '.mjs',
    '.cjs',
    '.cts',
  ];

  // TODO: This can be removed when vue is stable
  if (isVuePluginInstalled()) {
    moduleExtensions.push('.vue');
  }

  for (const [project, fileData] of Object.entries(
    ctx.fileMap.projectFileMap
  )) {
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
        isRoot(ctx.projects, dependency.source) ||
        !isRoot(ctx.projects, dependency.target)
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
        isRoot(ctx.projects, dependency.source) ||
        !isRoot(ctx.projects, dependency.target)
      ) {
        validateDependency(dependency, ctx);
        res.push(dependency);
      }
    }
  }

  return res;
}

function isVuePluginInstalled() {
  try {
    // nx-ignore-next-line
    require.resolve('@nx/vue');
    return true;
  } catch {
    return false;
  }
}
