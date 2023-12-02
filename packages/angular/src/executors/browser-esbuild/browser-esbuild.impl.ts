import type { BuilderOutput } from '@angular-devkit/architect';
import { readCachedProjectGraph, type ExecutorContext } from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import type { OutputFile } from 'esbuild';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { loadPlugins } from '../utilities/esbuild-extensions';
import { createTmpTsConfigForBuildableLibs } from './lib/buildable-libs';
import type { EsBuildSchema } from './schema';

export default async function* esbuildExecutor(
  options: EsBuildSchema,
  context: ExecutorContext
) {
  options.buildLibsFromSource ??= true;

  const {
    buildLibsFromSource,
    plugins: pluginPaths,
    ...delegateExecutorOptions
  } = options;

  let dependencies: DependentBuildableProjectNode[];
  let projectGraph = context.projectGraph;

  if (!buildLibsFromSource) {
    projectGraph = projectGraph ?? readCachedProjectGraph();
    const { tsConfigPath, dependencies: foundDependencies } =
      createTmpTsConfigForBuildableLibs(
        delegateExecutorOptions.tsConfig,
        context,
        { projectGraph }
      );
    dependencies = foundDependencies;
    delegateExecutorOptions.tsConfig = tsConfigPath;
  }

  const plugins = await loadPlugins(pluginPaths, options.tsConfig);

  const { buildEsbuildBrowser } = await import(
    '@angular-devkit/build-angular/src/builders/browser-esbuild/index'
  );

  const builderContext = await createBuilderContext(
    {
      builderName: 'browser-esbuild',
      description: 'Build a browser application',
      optionSchema: await import(
        '@angular-devkit/build-angular/src/builders/browser-esbuild/schema.json'
      ),
    },
    context
  );

  return yield* buildEsbuildBrowser(
    delegateExecutorOptions,
    builderContext,
    /* infrastructureSettings */ undefined,
    plugins
  ) as AsyncIterable<
    BuilderOutput & {
      outputFiles?: OutputFile[];
      assetFiles?: { source: string; destination: string }[];
    }
  >;
}
