import type { ExecutorContext } from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import { loadPlugins } from '../utilities/esbuild-extensions';
import type { ApplicationExecutorOptions } from './schema';
import { validateOptions } from './utils/validate-options';

export default async function* applicationExecutor(
  options: ApplicationExecutorOptions,
  context: ExecutorContext
) {
  validateOptions(options);

  const {
    buildLibsFromSource = true,
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

  const { buildApplication } = await import('@angular-devkit/build-angular');
  const builderContext = await createBuilderContext(
    {
      builderName: 'application',
      description: 'Build an application.',
      optionSchema: await import('./schema.json'),
    },
    context
  );

  return yield* buildApplication(
    delegateExecutorOptions,
    builderContext,
    plugins
  );
}
