import { ExecutorContext } from '@nrwl/devkit';
import { compileTypeScriptFiles } from '@nrwl/js/src/utils/typescript/compile-typescript-files';
import {
  assetGlobsToFiles,
  copyAssetFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { join, resolve } from 'path';
import { eachValueFrom } from 'rxjs-for-await';
import { map } from 'rxjs/operators';
import { checkDependencies } from '../../utils/check-dependencies';
import {
  ExecutorEvent,
  ExecutorOptions,
  NormalizedExecutorOptions,
} from '../../utils/schema';
import { updatePackageJson } from '../../utils/update-package-json';

function normalizeOptions(
  options: ExecutorOptions,
  contextRoot: string,
  sourceRoot?: string,
  projectRoot?: string
): NormalizedExecutorOptions {
  const outputPath = join(contextRoot, options.outputPath);

  if (options.watch == null) {
    options.watch = false;
  }

  const files: FileInputOutput[] = assetGlobsToFiles(
    options.assets,
    contextRoot,
    outputPath
  );

  return {
    ...options,
    root: contextRoot,
    sourceRoot,
    projectRoot,
    files,
    outputPath,
    tsConfig: join(contextRoot, options.tsConfig),
    mainOutputPath: resolve(
      outputPath,
      options.main.replace(`${projectRoot}/`, '').replace('.ts', '.js')
    ),
  };
}

export async function* tscExecutor(
  options: ExecutorOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } = context.workspace.projects[context.projectName];
  const normalizedOptions = normalizeOptions(
    options,
    context.root,
    sourceRoot,
    root
  );

  const { projectRoot, tmpTsConfig, shouldContinue } = checkDependencies(
    context,
    options.tsConfig
  );

  if (!shouldContinue) {
    return { success: false };
  }

  if (tmpTsConfig) {
    normalizedOptions.tsConfig = tmpTsConfig;
  }

  return yield* eachValueFrom(
    compileTypeScriptFiles(normalizedOptions, context, async () => {
      await updatePackageAndCopyAssets(normalizedOptions, projectRoot);
    }).pipe(
      map(
        (success) =>
          ({
            success,
            outfile: normalizedOptions.mainOutputPath,
          } as ExecutorEvent)
      )
    )
  );

  // return compileTypeScriptFiles(normalizedOptions, context, async () => {
  //   await updatePackageAndCopyAssets(normalizedOptions, projectRoot);
  // }).then(({ success }) => ({
  //   success,
  //   outfile: normalizedOptions.mainOutputPath,
  // }));
}

async function updatePackageAndCopyAssets(
  options: NormalizedExecutorOptions,
  projectRoot: string
) {
  await copyAssetFiles(options.files);
  updatePackageJson(options.main, options.outputPath, projectRoot);
}

export default tscExecutor;
