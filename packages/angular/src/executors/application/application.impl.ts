import type { BuilderOutput } from '@angular-devkit/architect';
import type { ExecutorContext } from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/internal';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import { assertBuilderPackageIsInstalled } from '../utilities/builder-package';
import {
  loadIndexHtmlTransformer,
  loadPlugins,
} from '../utilities/esbuild-extensions';
import type { ApplicationExecutorOptions } from './schema';
import { validateOptions } from './utils/validate-options';

export default async function* applicationExecutor(
  options: ApplicationExecutorOptions,
  context: ExecutorContext
): AsyncIterable<BuilderOutput> {
  validateOptions(options);

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
      builderName: '@nx/angular:application',
      description: 'Build an application.',
      optionSchema: require('./schema.json'),
    },
    context
  );

  assertBuilderPackageIsInstalled('@angular/build');
  const { buildApplication } = await import('@angular/build');
  return yield* buildApplication(delegateExecutorOptions, builderContext, {
    codePlugins: plugins,
    indexHtmlTransformer,
  });
}
