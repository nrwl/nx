import { ExecutorContext } from '@nx/devkit';
import { DependentBuildableProjectNode } from '../buildable-libs-utils';

import { watchForSingleFileChanges } from '../watch-for-single-file-changes';
import type { UpdatePackageJsonOption } from './update-package-json';
import { updatePackageJson } from './update-package-json';
import { checkDependencies } from '../check-dependencies';

export interface CopyPackageJsonOptions
  extends Omit<UpdatePackageJsonOption, 'projectRoot'> {
  watch?: boolean;
  extraDependencies?: DependentBuildableProjectNode[];
  overrideDependencies?: DependentBuildableProjectNode[];
}

export interface CopyPackageJsonResult {
  success?: boolean;
  // Only when "watch: true"
  stop?: () => void;
}

export async function copyPackageJson(
  _options: CopyPackageJsonOptions,
  context: ExecutorContext
): Promise<CopyPackageJsonResult> {
  if (!context.target.options.tsConfig) {
    throw new Error(
      `Could not find tsConfig option for "${context.targetName}" target of "${context.projectName}" project. Check that your project configuration is correct.`
    );
  }
  let { target, dependencies, projectRoot } = checkDependencies(
    context,
    context.target.options.tsConfig
  );
  const options = { ..._options, projectRoot };

  if (options.extraDependencies) {
    dependencies.push(...options.extraDependencies);
  }
  if (options.overrideDependencies) {
    dependencies = options.overrideDependencies;
  }

  if (options.watch) {
    const dispose = await watchForSingleFileChanges(
      context.projectName,
      options.projectRoot,
      'package.json',
      () => updatePackageJson(options, context, target, dependencies)
    );
    // Copy it once before changes
    updatePackageJson(options, context, target, dependencies);
    return { success: true, stop: dispose };
  } else {
    updatePackageJson(options, context, target, dependencies);
    return { success: true };
  }
}
