import { ExecutorContext } from '@nrwl/devkit';
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
  NormalizedSwcExecutorOptions,
  SwcExecutorOptions,
} from '../../utils/schema';
import { compileSwc } from '../../utils/swc/compile-swc';
import { updatePackageJson } from '../../utils/update-package-json';

export function normalizeOptions(
  options: SwcExecutorOptions,
  contextRoot: string,
  sourceRoot?: string,
  projectRoot?: string
): NormalizedSwcExecutorOptions {
  const outputPath = join(contextRoot, options.outputPath);

  if (options.skipTypeCheck == null) {
    options.skipTypeCheck = false;
  }

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
    mainOutputPath: resolve(
      outputPath,
      options.main.replace(`${projectRoot}/`, '').replace('.ts', '.js')
    ),
    files,
    root: contextRoot,
    sourceRoot,
    projectRoot,
    outputPath,
    tsConfig: join(contextRoot, options.tsConfig),
  } as NormalizedSwcExecutorOptions;
}

export async function* swcExecutor(
  options: SwcExecutorOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } = context.workspace.projects[context.projectName];
  const normalizedOptions = normalizeOptions(
    options,
    context.root,
    sourceRoot,
    root
  );
  const { shouldContinue, tmpTsConfig, projectRoot } = checkDependencies(
    context,
    options.tsConfig
  );

  if (!shouldContinue) {
    return { success: false };
  }

  if (tmpTsConfig) {
    normalizedOptions.tsConfig = tmpTsConfig;
  }

  const postCompilationCallback = async () => {
    await updatePackageAndCopyAssets(normalizedOptions, projectRoot);
  };

  return yield* eachValueFrom(
    compileSwc(context, normalizedOptions, postCompilationCallback).pipe(
      map(
        ({ success }) =>
          ({
            success,
            outfile: normalizedOptions.mainOutputPath,
          } as ExecutorEvent)
      )
    )
  );
}

async function updatePackageAndCopyAssets(
  options: NormalizedSwcExecutorOptions,
  projectRoot: string
) {
  await copyAssetFiles(options.files);
  updatePackageJson(
    options.main,
    options.outputPath,
    projectRoot,
    !options.skipTypeCheck
  );
}

export default swcExecutor;
