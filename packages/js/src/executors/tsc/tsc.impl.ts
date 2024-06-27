import * as ts from 'typescript';
import { ExecutorContext, isDaemonEnabled, output } from '@nx/devkit';
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
import { updatePackageJson } from '../../utils/package-json/update-package-json';
import { ExecutorOptions, NormalizedExecutorOptions } from '../../utils/schema';
import { compileTypeScriptFiles } from '../../utils/typescript/compile-typescript-files';
import { watchForSingleFileChanges } from '../../utils/watch-for-single-file-changes';
import { getCustomTrasformersFactory, normalizeOptions } from './lib';
import { readTsConfig } from '../../utils/typescript/ts-config';
import { createEntryPoints } from '../../utils/package-json/create-entry-points';

export function determineModuleFormatFromTsConfig(
  absolutePathToTsConfig: string
): 'cjs' | 'esm' {
  const tsConfig = readTsConfig(absolutePathToTsConfig);
  if (
    tsConfig.options.module === ts.ModuleKind.ES2015 ||
    tsConfig.options.module === ts.ModuleKind.ES2020 ||
    tsConfig.options.module === ts.ModuleKind.ES2022 ||
    tsConfig.options.module === ts.ModuleKind.ESNext
  ) {
    return 'esm';
  } else {
    return 'cjs';
  }
}

export function createTypeScriptCompilationOptions(
  normalizedOptions: NormalizedExecutorOptions,
  context: ExecutorContext
): TypeScriptCompilationOptions {
  return {
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot: normalizedOptions.projectRoot,
    rootDir: normalizedOptions.rootDir,
    tsConfig: normalizedOptions.tsConfig,
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
      updatePackageJson(
        {
          ...options,
          additionalEntryPoints: createEntryPoints(
            options.additionalEntryPoints,
            context.root
          ),
          format: [determineModuleFormatFromTsConfig(options.tsConfig)],
          // As long as d.ts files match their .js counterparts, we don't need to emit them.
          // TSC can match them correctly based on file names.
          skipTypings: true,
        },
        context,
        target,
        dependencies
      );
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
    const disposePackageJsonChanges = await watchForSingleFileChanges(
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
            // As long as d.ts files match their .js counterparts, we don't need to emit them.
            // TSC can match them correctly based on file names.
            skipTypings: true,
            format: [determineModuleFormatFromTsConfig(options.tsConfig)],
          },
          context,
          target,
          dependencies
        )
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
