import { ExecutorContext } from '@nrwl/devkit';
import { readCachedProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import { copyAssetFiles } from '@nrwl/workspace/src/utilities/assets';
import {
  calculateDependenciesFromEntryPoint,
  checkDependentProjectsHaveBeenBuilt,
  updateBuildableProjectPackageJsonDependencies,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { NodePackageBuilderOptions } from './utils/models';
import compileTypeScriptFiles from './utils/compile-typescript-files';
import updatePackageJson from './utils/update-package-json';
import normalizeOptions from './utils/normalize-options';
import addCliWrapper from './utils/cli';

export async function packageExecutor(
  options: NodePackageBuilderOptions,
  context: ExecutorContext
) {
  const libRoot = context.workspace.projects[context.projectName].root;
  const normalizedOptions = normalizeOptions(options, context, libRoot);
  const { target, dependencies } = calculateDependenciesFromEntryPoint(
    readCachedProjectGraph(),
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName,
    normalizedOptions.main
  );
  const dependentsBuilt = checkDependentProjectsHaveBeenBuilt(
    context.root,
    context.projectName,
    context.targetName,
    dependencies
  );
  if (!dependentsBuilt) {
    throw new Error();
  }

  const result = await compileTypeScriptFiles(
    normalizedOptions,
    context,
    libRoot,
    dependencies,
    async () =>
      await updatePackageAndCopyAssets(
        normalizedOptions,
        context,
        target,
        dependencies
      )
  );

  if (options.cli) {
    addCliWrapper(normalizedOptions, context);
  }

  return {
    ...(result as { success: boolean }),
    outputPath: normalizedOptions.outputPath,
  };
}

async function updatePackageAndCopyAssets(
  options,
  context,
  target,
  dependencies
) {
  await copyAssetFiles(options.files);

  updatePackageJson(options, context);
  if (
    dependencies.length > 0 &&
    options.updateBuildableProjectDepsInPackageJson
  ) {
    updateBuildableProjectPackageJsonDependencies(
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName,
      target,
      dependencies,
      options.buildableProjectDepsInPackageJsonType
    );
  }
}

export default packageExecutor;
