import type { ExecutorContext } from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import { loadPlugins } from '../utilities/esbuild-extensions';
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

  if (!buildLibsFromSource) {
    const { tsConfigPath, dependencies: foundDependencies } =
      createTmpTsConfigForBuildableLibs(
        delegateExecutorOptions.tsConfig,
        context
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
  );
}
