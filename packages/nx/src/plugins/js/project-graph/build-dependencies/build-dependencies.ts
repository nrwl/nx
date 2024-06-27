import { ProjectGraphProjectNode } from '../../../../config/project-graph';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../../project-graph/project-graph-builder';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { TargetProjectLocator } from './target-project-locator';

export function buildExplicitDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  if (totalNumberOfFilesToProcess(ctx) === 0) return [];

  let dependencies: RawProjectGraphDependency[] = [];

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
        buildExplicitTypeScriptDependencies(ctx, targetProjectLocator)
      );
    }
  }
  if (
    jsPluginConfig.analyzePackageJson === undefined ||
    jsPluginConfig.analyzePackageJson === true
  ) {
    dependencies = dependencies.concat(
      buildExplicitPackageJsonDependencies(ctx, targetProjectLocator)
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
