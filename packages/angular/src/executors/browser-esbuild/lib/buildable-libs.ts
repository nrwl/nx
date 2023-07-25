import {
  calculateProjectDependencies,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nx/js/src/utils/buildable-libs-utils';
import { join } from 'path';
import {
  type ExecutorContext,
  type ProjectGraph,
  readCachedProjectGraph,
} from '@nx/devkit';

export function createTmpTsConfigForBuildableLibs(
  tsConfigPath: string,
  context: ExecutorContext,
  options?: { projectGraph?: ProjectGraph; target?: string }
) {
  let dependencies: DependentBuildableProjectNode[];
  const result = calculateProjectDependencies(
    options?.projectGraph ?? readCachedProjectGraph(),
    context.root,
    context.projectName,
    options?.target ?? context.targetName,
    context.configurationName
  );
  dependencies = result.dependencies;

  const tmpTsConfigPath = createTmpTsConfig(
    join(context.root, tsConfigPath),
    context.root,
    result.target.data.root,
    dependencies
  );
  process.env.NX_TSCONFIG_PATH = tmpTsConfigPath;
  // Angular EsBuild Builder appends the workspaceRoot to the config path, so remove it.
  const tmpTsConfigPathWithoutWorkspaceRoot = tmpTsConfigPath.replace(
    context.root,
    ''
  );

  return { tsConfigPath: tmpTsConfigPathWithoutWorkspaceRoot, dependencies };
}
