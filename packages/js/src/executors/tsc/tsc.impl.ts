import { ExecutorContext } from '@nrwl/devkit';
import {
  assetGlobsToFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { join, resolve } from 'path';
import { checkDependencies } from '../../utils/check-dependencies';
import { CopyAssetsHandler } from '../../utils/copy-assets-handler';
import { ExecutorOptions, NormalizedExecutorOptions } from '../../utils/schema';
import { compileTypeScriptFiles } from '../../utils/typescript/compile-typescript-files';
import { updatePackageJson } from '../../utils/update-package-json';
import { watchForSingleFileChanges } from '../../utils/watch-for-single-file-changes';

export function normalizeOptions(
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
  _options: ExecutorOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } = context.workspace.projects[context.projectName];
  const options = normalizeOptions(_options, context.root, sourceRoot, root);

  const { projectRoot, tmpTsConfig } = checkDependencies(
    context,
    _options.tsConfig
  );

  if (tmpTsConfig) {
    options.tsConfig = tmpTsConfig;
  }

  const assetHandler = new CopyAssetsHandler({
    projectDir: projectRoot,
    rootDir: context.root,
    outputDir: _options.outputPath,
    assets: _options.assets,
  });

  if (options.watch) {
    const disposeWatchAssetChanges =
      await assetHandler.watchAndProcessOnAssetChange();
    const disposePackageJsonChanged = await watchForSingleFileChanges(
      join(context.root, projectRoot),
      'package.json',
      () => updatePackageJson(options.main, options.outputPath, projectRoot)
    );
    process.on('exit', async () => {
      await disposeWatchAssetChanges();
      await disposePackageJsonChanged();
    });
    process.on('SIGTERM', async () => {
      await disposeWatchAssetChanges();
      await disposePackageJsonChanged();
    });
  }

  return yield* compileTypeScriptFiles(options, context, async () => {
    await assetHandler.processAllAssetsOnce();
    updatePackageJson(options.main, options.outputPath, projectRoot);
  });
}

export default tscExecutor;
