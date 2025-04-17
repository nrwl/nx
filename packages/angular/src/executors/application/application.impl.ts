import type { buildApplication as buildApplicationFn } from '@angular-devkit/build-angular';
import type { ExecutorContext } from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import {
  loadIndexHtmlTransformer,
  loadPlugins,
} from '../utilities/esbuild-extensions';
import type { ApplicationExecutorOptions } from './schema';
import { normalizeOptions } from './utils/normalize-options';
import { validateOptions } from './utils/validate-options';

export default async function* applicationExecutor(
  options: ApplicationExecutorOptions,
  context: ExecutorContext
): ReturnType<typeof buildApplicationFn> {
  validateOptions(options);
  options = normalizeOptions(options);

  const {
    buildLibsFromSource = true,
    plugins: pluginPaths,
    indexHtmlTransformer: indexHtmlTransformerPath,
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
  const indexHtmlTransformer = indexHtmlTransformerPath
    ? await loadIndexHtmlTransformer(indexHtmlTransformerPath, options.tsConfig)
    : undefined;

  const builderContext = await createBuilderContext(
    {
      builderName: 'application',
      description: 'Build an application.',
      optionSchema: require('./schema.json'),
    },
    context
  );

  const { buildApplication } = await import('@angular-devkit/build-angular');
  return yield* buildApplication(delegateExecutorOptions, builderContext, {
    codePlugins: plugins,
    indexHtmlTransformer,
  });
}
