import {
  calculateProjectDependencies,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nx/js/internal';
import { ProjectGraph, readCachedProjectGraph } from '@nx/devkit';
import { join } from 'path';

export function createTmpTsConfigForBuildableLibs(
  tsConfigPath: string,
  context: import('@angular-devkit/architect').BuilderContext,
  options?: { projectGraph?: ProjectGraph; target?: string }
) {
  const { target } = context;
  if (!target) {
    throw new Error('The builder context has no target.');
  }
  let dependencies: DependentBuildableProjectNode[];
  const result = calculateProjectDependencies(
    options?.projectGraph ?? readCachedProjectGraph(),
    context.workspaceRoot,
    target.project,
    options?.target ?? target.target,
    target.configuration
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
