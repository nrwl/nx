import * as ts from 'typescript';
import {
  ExecutorContext,
  isDaemonEnabled,
  joinPathFragments,
  output,
} from '@nx/devkit';
import type { TypeScriptCompilationOptions } from '@nx/workspace/src/utilities/typescript/compilation';
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
import { updatePackageJson, type SupportedFormat } from '../../utils/package-json/update-package-json';
import { ExecutorOptions, NormalizedExecutorOptions } from '../../utils/schema';
import { compileTypeScriptFiles } from '../../utils/typescript/compile-typescript-files';
import { watchForSingleFileChanges } from '../../utils/watch-for-single-file-changes';
import { getCustomTrasformersFactory, normalizeOptions } from './lib';
import { readTsConfig } from '../../utils/typescript/ts-config';
import { createEntryPoints } from '../../utils/package-json/create-entry-points';

export function determineModuleFormatFromTsConfig(
  absolutePathToTsConfig: string
): SupportedFormat | undefined {
  const tsConfig = readTsConfig(absolutePathToTsConfig);
  switch (tsConfig.options.module) {
    case ts.ModuleKind.ES2015:
    case ts.ModuleKind.ES2020:
    case ts.ModuleKind.ES2022:
    case ts.ModuleKind.ESNext:
      return 'esm';
    case ts.ModuleKind.CommonJS:
    case ts.ModuleKind.AMD:
    case ts.ModuleKind.UMD:
    case ts.ModuleKind.System:
    case ts.ModuleKind.None:
    case ts.ModuleKind.Preserve:
        return 'cjs';
    case ts.ModuleKind.Node16:
    case ts.ModuleKind.Node18:
    case ts.ModuleKind.NodeNext:
      return undefined;
    default:
      return tsConfig.options.module satisfies never;
  }
}

export function createTypeScriptCompilationOptions(
  normalizedOptions: NormalizedExecutorOptions,
  context: ExecutorContext
): TypeScriptCompilationOptions {
  return {
    outputPath: joinPathFragments(normalizedOptions.outputPath),
    projectName: context.projectName,
    projectRoot: normalizedOptions.projectRoot,
    rootDir: joinPathFragments(normalizedOptions.rootDir),
    tsConfig: joinPathFragments(normalizedOptions.tsConfig),
    watch: normalizedOptions.watch,
    deleteOutputPath: normalizedOptions.clean,
    getCustomTransformers: getCustomTrasformersFactory(
      normalizedOptions.transformers
    ),
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
    options.tsConfig
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
    includeIgnoredFiles: _options.includeIgnoredAssetFiles,
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
      if (options.generatePackageJson) {
        updatePackageJson(
          {
            ...options,
            additionalEntryPoints: createEntryPoints(
              options.additionalEntryPoints,
              context.root
            ),
            format: [determineModuleFormatFromTsConfig(options.tsConfig)],
          },
          context,
          target,
          dependencies
        );
      }
      postProcessInlinedDependencies(
        tsCompilationOptions.outputPath,
        tsCompilationOptions.projectRoot,
        inlineProjectGraph
      );
    }
  );

  if (!isDaemonEnabled() && options.watch) {
    output.warn({
      title:
        'Nx Daemon is not enabled. Assets and package.json files will not be updated when files change.',
    });
  }

  if (isDaemonEnabled() && options.watch) {
    const disposeWatchAssetChanges =
      await assetHandler.watchAndProcessOnAssetChange();
    let disposePackageJsonChanges: undefined | (() => void);
    if (options.generatePackageJson) {
      disposePackageJsonChanges = await watchForSingleFileChanges(
        context.projectName,
        options.projectRoot,
        'package.json',
        () =>
          updatePackageJson(
            {
              ...options,
              additionalEntryPoints: createEntryPoints(
                options.additionalEntryPoints,
                context.root
              ),
              format: [determineModuleFormatFromTsConfig(options.tsConfig)],
            },
            context,
            target,
            dependencies
          )
      );
    }
    const handleTermination = async (exitCode: number) => {
      await typescriptCompilation.close();
      disposeWatchAssetChanges();
      disposePackageJsonChanges?.();
      process.exit(exitCode);
    };
    process.on('SIGINT', () => handleTermination(128 + 2));
    process.on('SIGTERM', () => handleTermination(128 + 15));
  }

  return yield* typescriptCompilation.iterator;
}

export default tscExecutor;
