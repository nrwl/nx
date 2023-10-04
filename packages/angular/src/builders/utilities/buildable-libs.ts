import {
  calculateProjectDependencies,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nx/js/src/utils/buildable-libs-utils';
import { ProjectGraph, readCachedProjectGraph } from '@nx/devkit';
import { join } from 'path';

export function createTmpTsConfigForBuildableLibs(
  tsConfigPath: string,
  context: import('@angular-devkit/architect').BuilderContext,
  options?: { projectGraph?: ProjectGraph; target?: string }
) {
  let dependencies: DependentBuildableProjectNode[];
  const result = calculateProjectDependencies(
    options?.projectGraph ?? readCachedProjectGraph(),
    context.workspaceRoot,
    context.target.project,
    options?.target ?? context.target.target,
    context.target.configuration
  );
  dependencies = result.dependencies;

  const tmpTsConfigPath = createTmpTsConfig(
    join(context.workspaceRoot, tsConfigPath),
    context.workspaceRoot,
    result.target.data.root,
    dependencies
  );
  process.env.NX_TSCONFIG_PATH = tmpTsConfigPath;

  return { tsConfigPath: tmpTsConfigPath, dependencies };
}
