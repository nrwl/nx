import { join, relative } from 'path';
import {
  DependencyType,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';
import { ProjectConfiguration } from '../../../../config/workspace-json-project-json';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../../project-graph/project-graph-builder';
import { normalizePath } from '../../../../utils/path';
import { workspaceRoot } from '../../../../utils/workspace-root';
import { ExternalDependenciesCache } from './build-dependencies';
import { TargetProjectLocator } from './target-project-locator';

function isRoot(
  projects: Record<string, ProjectConfiguration>,
  projectName: string
): boolean {
  return projects[projectName]?.root === '.';
}

function getPackageName(importExpression: string) {
  // Check if the package is scoped
  if (importExpression.startsWith('@')) {
    // For scoped packages, the package name is up to the second '/'
    return importExpression.split('/').slice(0, 2).join('/');
  }
  // For unscoped packages, the package name is up to the first '/'
  return importExpression.split('/')[0];
}

function convertImportToDependency(
  importExpr: string,
  externalDependenciesCache: ExternalDependenciesCache,
  sourceFile: string,
  source: string,
  type: RawProjectGraphDependency['type'],
  targetProjectLocator: TargetProjectLocator
): RawProjectGraphDependency {
  /**
   * First try and find in the cache populated by the package.json dependencies, then try and find in the project graph,
   * and finally default to an assumed root level external dependency.
   */
  const cachedDeps = externalDependenciesCache.get(source);
  let target: string | undefined;
  if (cachedDeps) {
    // Certain dependencies contain nested entrypoints, we need to compare to the actual package name within the importExpr
    const packageName = getPackageName(importExpr);
    for (const dep of cachedDeps) {
      if (dep.startsWith(`npm:${packageName}`)) {
        target = dep;
        break;
      }
    }
  }
  target =
    target ??
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
  ctx: CreateDependenciesContext,
  externalDependenciesCache: ExternalDependenciesCache
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
        externalDependenciesCache,
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
        externalDependenciesCache,
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
