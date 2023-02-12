import { ExecutorContext } from '@nrwl/devkit';
import {
  assetGlobsToFiles,
  FileInputOutput,
} from '@nrwl/workspace/src/utilities/assets';
import type { TypeScriptCompilationOptions } from '@nrwl/workspace/src/utilities/typescript/compilation';
import { join, resolve } from 'path';
import {
  CustomTransformers,
  Program,
  SourceFile,
  TransformerFactory,
} from 'typescript';
import { CopyAssetsHandler } from '../../utils/assets/copy-assets-handler';
import { checkDependencies } from '../../utils/check-dependencies';
import {
  getHelperDependency,
  HelperDependency,
} from '../../utils/compiler-helper-dependency';
import {
  handleInliningBuild,
  isInlineGraphEmpty,
  postProcessInlinedDependencies,
} from '../../utils/inline';
import { updatePackageJson } from '../../utils/package-json/update-package-json';
import { ExecutorOptions, NormalizedExecutorOptions } from '../../utils/schema';
import { compileTypeScriptFiles } from '../../utils/typescript/compile-typescript-files';
import { loadTsTransformers } from '../../utils/typescript/load-ts-transformers';
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

  // TODO: put back when inlining story is more stable
  // if (options.external == null) {
  //   options.external = 'all';
  // } else if (Array.isArray(options.external) && options.external.length === 0) {
  //   options.external = 'none';
  // }

  if (Array.isArray(options.external) && options.external.length > 0) {
    const firstItem = options.external[0];
    if (firstItem === 'all' || firstItem === 'none') {
      options.external = firstItem;
    }
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
  const { sourceRoot, root } =
    context.projectsConfigurations.projects[context.projectName];
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

  const tsCompilationOptions = createTypeScriptCompilationOptions(
    options,
    context
  );

  const inlineProjectGraph = handleInliningBuild(
    context,
    options,
    tsCompilationOptions.tsConfig
  );

  if (!isInlineGraphEmpty(inlineProjectGraph)) {
    tsCompilationOptions.rootDir = '.';
  }

  const typescriptCompilation = compileTypeScriptFiles(
    options,
    tsCompilationOptions,
    async () => {
      await assetHandler.processAllAssetsOnce();
      updatePackageJson(options, context, target, dependencies);
      postProcessInlinedDependencies(
        tsCompilationOptions.outputPath,
        tsCompilationOptions.projectRoot,
        inlineProjectGraph
      );
    }
  );

  if (options.watch) {
    const disposeWatchAssetChanges =
      await assetHandler.watchAndProcessOnAssetChange();
    const disposePackageJsonChanges = await watchForSingleFileChanges(
      context.projectName,
      options.projectRoot,
      'package.json',
      () => updatePackageJson(options, context, target, dependencies)
    );
    const handleTermination = async (exitCode: number) => {
      await typescriptCompilation.close();
      disposeWatchAssetChanges();
      disposePackageJsonChanges();
      process.exit(exitCode);
    };
    process.on('SIGINT', () => handleTermination(128 + 2));
    process.on('SIGTERM', () => handleTermination(128 + 15));
  }

  return yield* typescriptCompilation.iterator;
}

export default tscExecutor;
