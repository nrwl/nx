import { ExecutorContext } from '@nrwl/devkit';
import {
  assetGlobsToFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import { TypeScriptCompilationOptions } from '@nrwl/workspace/src/utilities/typescript/compilation';
import { join, resolve } from 'path';
import {
  CustomTransformers,
  Program,
  SourceFile,
  TransformerFactory,
} from 'typescript';
import { checkDependencies } from '../../utils/check-dependencies';
import {
  getHelperDependency,
  HelperDependency,
} from '../../utils/compiler-helper-dependency';
import { CopyAssetsHandler } from '../../utils/copy-assets-handler';
import { ExecutorOptions, NormalizedExecutorOptions } from '../../utils/schema';
import { compileTypeScriptFiles } from '../../utils/typescript/compile-typescript-files';
import { loadTsTransformers } from '../../utils/typescript/load-ts-transformers';
import { updatePackageJson } from '../../utils/update-package-json';
import { watchForSingleFileChanges } from '../../utils/watch-for-single-file-changes';

export function normalizeOptions(
  options: ExecutorOptions,
  contextRoot: string,
  sourceRoot: string,
  projectRoot: string
): NormalizedExecutorOptions {
  const outputPath = join(contextRoot, options.outputPath);
  const rootDir = options.rootDir
    ? join(contextRoot, options.rootDir)
    : projectRoot;

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
    rootDir,
    mainOutputPath: resolve(
      outputPath,
      options.main.replace(`${projectRoot}/`, '').replace('.ts', '.js')
    ),
  };
}

export function createTypeScriptCompilationOptions(
  normalizedOptions: NormalizedExecutorOptions,
  context: ExecutorContext
): TypeScriptCompilationOptions {
  const { compilerPluginHooks } = loadTsTransformers(
    normalizedOptions.transformers
  );
  const getCustomTransformers = (program: Program): CustomTransformers => ({
    before: compilerPluginHooks.beforeHooks.map(
      (hook) => hook(program) as TransformerFactory<SourceFile>
    ),
    after: compilerPluginHooks.afterHooks.map(
      (hook) => hook(program) as TransformerFactory<SourceFile>
    ),
    afterDeclarations: compilerPluginHooks.afterDeclarationsHooks.map(
      (hook) => hook(program) as TransformerFactory<SourceFile>
    ),
  });

  return {
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot: normalizedOptions.projectRoot,
    rootDir: normalizedOptions.rootDir,
    tsConfig: normalizedOptions.tsConfig,
    watch: normalizedOptions.watch,
    deleteOutputPath: normalizedOptions.clean,
    getCustomTransformers,
  };
}

export async function* tscExecutor(
  _options: ExecutorOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } = context.workspace.projects[context.projectName];
  const options = normalizeOptions(_options, context.root, sourceRoot, root);

  const { projectRoot, tmpTsConfig, target, dependencies } = checkDependencies(
    context,
    _options.tsConfig
  );

  if (tmpTsConfig) {
    options.tsConfig = tmpTsConfig;
  }

  const tsLibDependency = getHelperDependency(
    HelperDependency.tsc,
    options.tsConfig,
    dependencies,
    context.projectGraph
  );

  if (tsLibDependency) {
    dependencies.push(tsLibDependency);
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
    const disposePackageJsonChanges = await watchForSingleFileChanges(
      join(context.root, projectRoot),
      'package.json',
      () => updatePackageJson(options, context, target, dependencies)
    );
    const handleTermination = async () => {
      await disposeWatchAssetChanges();
      await disposePackageJsonChanges();
    };
    process.on('SIGINT', () => handleTermination());
    process.on('SIGTERM', () => handleTermination());
  }

  return yield* compileTypeScriptFiles(
    options,
    createTypeScriptCompilationOptions(options, context),
    async () => {
      await assetHandler.processAllAssetsOnce();
      updatePackageJson(options, context, target, dependencies);
    }
  );
}

export default tscExecutor;
