import { ExecutorContext } from '@nrwl/devkit';
import {
  assetGlobsToFiles,
  copyAssetFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { join } from 'path';
import { checkDependencies } from '../../utils/check-dependencies';
import { compile } from '../../utils/compile';
import { ExecutorOptions, NormalizedExecutorOptions } from '../../utils/schema';
import { updatePackageJson } from '../../utils/update-package-json';

export async function tscExecutor(
  options: ExecutorOptions,
  context: ExecutorContext
) {
  const normalizedOptions = normalizeOptions(options, context);

  const { projectRoot, tmpTsConfig, shouldContinue } = checkDependencies(
    context,
    normalizedOptions.tsConfig
  );

  if (!shouldContinue) {
    return { success: false };
  }

  if (tmpTsConfig) {
    normalizedOptions.tsConfig = tmpTsConfig;
  }

  const tsOptions = {
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot,
    tsConfig: normalizedOptions.tsConfig,
  };

  return compile('tsc', context, tsOptions, async () => {
    await updatePackageAndCopyAssets(normalizedOptions, projectRoot);
  });
}

async function updatePackageAndCopyAssets(
  options: NormalizedExecutorOptions,
  projectRoot: string
) {
  await copyAssetFiles(options.files);
  updatePackageJson(options.main, options.outputPath, projectRoot);
}

function normalizeOptions(
  options: ExecutorOptions,
  context: ExecutorContext
): NormalizedExecutorOptions {
  const outputPath = join(context.root, options.outputPath);

  const files: FileInputOutput[] = assetGlobsToFiles(
    options.assets,
    context.root,
    outputPath
  );

  return {
    ...options,
    files,
    outputPath,
    tsConfig: join(context.root, options.tsConfig),
  };
}

export default tscExecutor;
