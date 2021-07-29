import type { ExecutorContext } from '@nrwl/devkit';
import {
  joinPathFragments,
  parseTargetString,
  runExecutor,
} from '@nrwl/devkit';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import type { DelegateBuildExecutorSchema } from './schema';

export async function* delegateBuildExecutor(
  options: DelegateBuildExecutorSchema,
  context: ExecutorContext
) {
  const { target, dependencies } = calculateProjectDependencies(
    readCachedProjectGraph(),
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );

  options.tsConfig = createTmpTsConfig(
    joinPathFragments(context.root, options.tsConfig),
    context.root,
    target.data.root,
    dependencies
  );

  if (
    !checkDependentProjectsHaveBeenBuilt(
      context.root,
      context.projectName,
      context.targetName,
      dependencies
    )
  ) {
    return { success: false };
  }

  const { buildTarget, ...targetOptions } = options;
  const delegateTarget = parseTargetString(buildTarget);

  yield* await runExecutor(delegateTarget, targetOptions, context);
}

export default delegateBuildExecutor;
