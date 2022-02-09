import { ExecutorContext } from '@nrwl/devkit';
import {
  assetGlobsToFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { join, relative, resolve } from 'path';

import { checkDependencies } from '../../utils/check-dependencies';
import { CopyAssetsHandler } from '../../utils/copy-assets-handler';
import {
  NormalizedSwcExecutorOptions,
  SwcExecutorOptions,
} from '../../utils/schema';
import { addTempSwcrc } from '../../utils/swc/add-temp-swcrc';
import { compileSwc, compileSwcWatch } from '../../utils/swc/compile-swc';
import { updatePackageJson } from '../../utils/update-package-json';
import { watchForSingleFileChanges } from '../../utils/watch-for-single-file-changes';

function normalizeOptions(
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

  const swcCliOptions = {
    projectDir: projectRoot.split('/').pop(),
    // TODO: assume consumers put their code in `src`
    destPath: `${relative(projectRoot, options.outputPath)}/src`,
  };

  return {
    ...options,
    swcrcPath: join(projectRoot, '.swcrc'),
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
    swcCliOptions,
  } as NormalizedSwcExecutorOptions;
}

function processAssetsAndPackageJsonOnce(
  assetHandler: CopyAssetsHandler,
  options: NormalizedSwcExecutorOptions,
  projectRoot: string
) {
  return async () => {
    await assetHandler.processAllAssetsOnce();
    updatePackageJson(
      options.main,
      options.outputPath,
      projectRoot,
      !options.skipTypeCheck
    );
  };
}

export async function* swcExecutor(
  _options: SwcExecutorOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } = context.workspace.projects[context.projectName];
  const options = normalizeOptions(_options, context.root, sourceRoot, root);
  options.swcrcPath = addTempSwcrc(options);
  const { tmpTsConfig, projectRoot } = checkDependencies(
    context,
    options.tsConfig
  );

  if (tmpTsConfig) {
    options.tsConfig = tmpTsConfig;
  }

  const assetHandler = new CopyAssetsHandler({
    projectDir: projectRoot,
    rootDir: context.root,
    outputDir: options.outputPath,
    assets: options.assets,
  });

  if (options.watch) {
    const disposeWatchAssetChanges =
      await assetHandler.watchAndProcessOnAssetChange();
    const disposePackageJsonChanges = await watchForSingleFileChanges(
      join(context.root, projectRoot),
      'package.json',
      () =>
        updatePackageJson(
          options.main,
          options.outputPath,
          projectRoot,
          !options.skipTypeCheck
        )
    );
    process.on('exit', async () => {
      await disposeWatchAssetChanges();
      await disposePackageJsonChanges();
    });
    process.on('SIGTERM', async () => {
      await disposeWatchAssetChanges();
      await disposePackageJsonChanges();
    });

    return yield* compileSwcWatch(
      context,
      options,
      processAssetsAndPackageJsonOnce(assetHandler, options, projectRoot)
    );
  } else {
    return yield compileSwc(
      context,
      options,
      processAssetsAndPackageJsonOnce(assetHandler, options, projectRoot)
    );
  }
}

export default swcExecutor;
