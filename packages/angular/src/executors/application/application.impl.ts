import type { BuilderOutput } from '@angular-devkit/architect';
import type { ExecutorContext } from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { getInstalledAngularVersionInfo } from '../utilities/angular-version-utils.js';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs.js';
import { assertBuilderPackageIsInstalled } from '../utilities/builder-package.js';
import {
  loadIndexHtmlTransformer,
  loadPlugins,
} from '../utilities/esbuild-extensions.js';
import type { ApplicationExecutorOptions } from './schema';
import { normalizeOptions } from './utils/normalize-options.js';
import { validateOptions } from './utils/validate-options.js';

export default async function* applicationExecutor(
  options: ApplicationExecutorOptions,
  context: ExecutorContext
): AsyncIterable<BuilderOutput> {
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

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();
  if (angularMajorVersion >= 20) {
    assertBuilderPackageIsInstalled('@angular/build');
    const { buildApplication } = await import('@angular/build');
    return yield* buildApplication(delegateExecutorOptions, builderContext, {
      codePlugins: plugins,
      indexHtmlTransformer,
    });
  }

  assertBuilderPackageIsInstalled('@angular-devkit/build-angular');
  const { buildApplication } = await import('@angular-devkit/build-angular');
  return yield* buildApplication(delegateExecutorOptions, builderContext, {
    codePlugins: plugins,
    indexHtmlTransformer,
  });
}
