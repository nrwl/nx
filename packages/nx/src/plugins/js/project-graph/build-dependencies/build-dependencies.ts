import { ProjectGraphProjectNode } from '../../../../config/project-graph';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../../project-graph/project-graph-builder';
import { logger } from '../../../../utils/logger';
import { workspaceRoot } from '../../../../utils/workspace-root';
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
  const nodes: Record<string, ProjectGraphProjectNode> = {};
  Object.keys(ctx.projects).forEach((key) => {
    nodes[key] = {
      name: key,
      type: null,
      data: ctx.projects[key],
    };
  });
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
    } else {
      warnIfTypeScriptIsOnlyResolvableFromWorkspace();
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

let warnedAboutUnresolvableTypeScript = false;

function warnIfTypeScriptIsOnlyResolvableFromWorkspace() {
  if (warnedAboutUnresolvableTypeScript) {
    return;
  }
  try {
    require.resolve('typescript', { paths: [workspaceRoot] });
  } catch {
    return;
  }
  warnedAboutUnresolvableTypeScript = true;
  logger.warn(
    'Skipping the TypeScript import analysis because "typescript" cannot be resolved from where nx is installed, although it is installed in the workspace. The project graph is cached without import dependencies until this is fixed. After making "typescript" resolvable from nx, run "nx reset".'
  );
}

function totalNumberOfFilesToProcess(ctx: CreateDependenciesContext) {
  let totalNumOfFilesToProcess = 0;
  Object.values(ctx.filesToProcess.projectFileMap).forEach(
    (t) => (totalNumOfFilesToProcess += t.length)
  );
  return totalNumOfFilesToProcess;
}
