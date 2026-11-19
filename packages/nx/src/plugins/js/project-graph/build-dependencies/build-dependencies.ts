import { ProjectGraphProjectNode } from '../../../../config/project-graph';
import { CreateDependenciesContext } from '../../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../../project-graph/project-graph-builder';
import { logger } from '../../../../utils/logger';
import {
  getRootTsConfigFileName,
  isTypeScriptResolvable,
} from '../../utils/typescript';
import { buildExplicitPackageJsonDependencies } from './explicit-package-json-dependencies';
import { buildExplicitTypeScriptDependencies } from './explicit-project-dependencies';
import { TargetProjectLocator } from './target-project-locator';

export function buildExplicitDependencies(
  jsPluginConfig: {
    analyzeSourceFiles?: boolean;
    analyzePackageJson?: boolean;
  },
  ctx: CreateDependenciesContext,
  installedLocalPathNodes?: Record<string, Record<string, string>>
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
    ctx.externalNodes,
    undefined,
    undefined,
    installedLocalPathNodes
  );

  if (
    jsPluginConfig.analyzeSourceFiles === undefined ||
    jsPluginConfig.analyzeSourceFiles === true
  ) {
    if (getRootTsConfigFileName() && !isTypeScriptResolvable()) {
      logger.warn(
        `Nx could not resolve the "typescript" package from the workspace root, so imports that need TypeScript module resolution (such as "baseUrl" or inherited "paths") do not create project dependencies. Add "typescript" to the workspace root's dependencies to detect them.`
      );
    }
    dependencies = dependencies.concat(
      buildExplicitTypeScriptDependencies(ctx, targetProjectLocator)
    );
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
