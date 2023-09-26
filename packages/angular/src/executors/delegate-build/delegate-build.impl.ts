import type { ExecutorContext } from '@nx/devkit';
import { joinPathFragments, parseTargetString, runExecutor } from '@nx/devkit';
import {
  calculateProjectBuildableDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';
import type { DelegateBuildExecutorSchema } from './schema';

export async function* delegateBuildExecutor(
  options: DelegateBuildExecutorSchema,
  context: ExecutorContext
) {
  const { target, dependencies } = calculateProjectBuildableDependencies(
    context.taskGraph,
    context.projectGraph,
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
  const delegateTarget = parseTargetString(buildTarget, context);

  yield* await runExecutor(delegateTarget, targetOptions, context);
}

export default delegateBuildExecutor;
