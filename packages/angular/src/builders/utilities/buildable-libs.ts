import {
  calculateProjectDependencies,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readCachedProjectGraph } from '@nrwl/devkit';
import { join } from 'path';

export function createTmpTsConfigForBuildableLibs(
  tsConfigPath: string,
  context: import('@angular-devkit/architect').BuilderContext,
  target?: string
) {
  let dependencies: DependentBuildableProjectNode[];
  const result = calculateProjectDependencies(
    readCachedProjectGraph(),
    context.workspaceRoot,
    context.target.project,
    target ?? context.target.target,
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
