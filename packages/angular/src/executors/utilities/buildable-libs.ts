import { readCachedProjectGraph, type ExecutorContext } from '@nx/devkit';
import {
  calculateProjectDependencies,
  createTmpTsConfig,
  type DependentBuildableProjectNode,
} from '@nx/js/src/utils/buildable-libs-utils';
import { join } from 'path';

export function createTmpTsConfigForBuildableLibs(
  tsConfigPath: string,
  context: ExecutorContext
) {
  let dependencies: DependentBuildableProjectNode[];
  const result = calculateProjectDependencies(
    context.projectGraph ?? readCachedProjectGraph(),
    context.root,
    context.projectName,
    context.targetName,
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

  const tmpTsConfigPathWithoutWorkspaceRoot = tmpTsConfigPath.replace(
    context.root,
    ''
  );

  return { tsConfigPath: tmpTsConfigPathWithoutWorkspaceRoot, dependencies };
}
