import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../../project-graph/project-graph-builder';

export function buildExplicitDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  if (totalNumberOfFilesToProcess(ctx) === 0) return [];

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
        buildExplicitTypeScriptDependencies(ctx)
      );
    }
  }
  if (
    jsPluginConfig.analyzePackageJson === undefined ||
    jsPluginConfig.analyzePackageJson === true
  ) {
    dependencies = dependencies.concat(
      buildExplicitPackageJsonDependencies(ctx)
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
