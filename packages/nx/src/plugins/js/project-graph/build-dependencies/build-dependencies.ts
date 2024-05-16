import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../../project-graph/project-graph-builder';

/**
 * When processing external dependencies, we need to keep track of which version of that dependency
 * is most appropriate for each source project. A workspace may contain multiple copies of a dependency
 * but we should base the graph on the version that is most relevant to the source project, otherwise
 * things like the dependency-check lint rule will not work as expected.
 *
 * We need to track this in this separate cache because the project file map that lives on the ctx will
 * only be updated at the very end.
 *
 * sourceProject => resolved external node names (e.g. 'npm:lodash@4.0.0')
 */
export type ExternalDependenciesCache = Map<string, Set<string>>;

export function buildExplicitDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  if (totalNumberOfFilesToProcess(ctx) === 0) return [];

  const externalDependenciesCache: ExternalDependenciesCache = new Map();
  let dependencies: RawProjectGraphDependency[] = [];

  if (
    jsPluginConfig.analyzeSourceFiles === undefined ||
    jsPluginConfig.analyzeSourceFiles === true
  ) {
    let tsExists = false;
    try {
      require.resolve('typescript');
      tsExists = true;
    } catch {}
    if (tsExists) {
      dependencies = dependencies.concat(
        buildExplicitTypeScriptDependencies(ctx, externalDependenciesCache)
      );
    }
  }
  if (
    jsPluginConfig.analyzePackageJson === undefined ||
    jsPluginConfig.analyzePackageJson === true
  ) {
    dependencies = dependencies.concat(
      buildExplicitPackageJsonDependencies(ctx, externalDependenciesCache)
    );
  }

  return dependencies;
}

function totalNumberOfFilesToProcess(ctx: CreateDependenciesContext) {
  let totalNumOfFilesToProcess = 0;
  Object.values(ctx.filesToProcess.projectFileMap).forEach(
    (t) => (totalNumOfFilesToProcess += t.length)
  );
  return totalNumOfFilesToProcess;
}
