import { stripIndents, type ExecutorContext } from '@nx/devkit';
import type { DependentBuildableProjectNode } from '@nx/js/src/utils/buildable-libs-utils';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { getInstalledAngularVersionInfo } from '../utilities/angular-version-utils';
import { createTmpTsConfigForBuildableLibs } from '../utilities/buildable-libs';
import { loadPlugins } from '../utilities/esbuild-extensions';
import type { EsBuildSchema } from './schema';

export default async function* esbuildExecutor(
  options: EsBuildSchema,
  context: ExecutorContext
) {
  if (options.plugins) {
    const { major: angularMajorVersion, version: angularVersion } =
      getInstalledAngularVersionInfo();
    if (angularMajorVersion < 17) {
      throw new Error(stripIndents`The "plugins" option is only supported in Angular >= 17.0.0. You are currently using "${angularVersion}".
        You can resolve this error by removing the "plugins" option or by migrating to Angular 17.0.0.`);
    }
  }

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
