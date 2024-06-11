import type { ExtractI18nBuilderOptions } from '@angular-devkit/build-angular';
import { parseTargetString, type ExecutorContext } from '@nx/devkit';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import { getInstalledAngularVersionInfo } from '../utilities/angular-version-utils';
import { patchBuilderContext } from '../utilities/patch-builder-context';
import type { ExtractI18nExecutorOptions } from './schema';

export default async function* extractI18nExecutor(
  options: ExtractI18nExecutorOptions,
  context: ExecutorContext
) {
  const parsedBuildTarget = parseTargetString(options.buildTarget, context);
  const browserTargetProjectConfiguration = readCachedProjectConfiguration(
    parsedBuildTarget.project
  );

  const buildTarget =
    browserTargetProjectConfiguration.targets[parsedBuildTarget.target];

  const isUsingEsbuildBuilder = [
    '@angular-devkit/build-angular:application',
    '@angular-devkit/build-angular:browser-esbuild',
    '@nx/angular:application',
    '@nx/angular:browser-esbuild',
  ].includes(buildTarget.executor);

  const builderContext = await createBuilderContext(
    {
      builderName: 'extrct-i18n',
      description: 'Extracts i18n messages from source code.',
      optionSchema: require('./schema.json'),
    },
    context
  );

  /**
   * The Angular CLI extract-i18n builder make some decisions based on the build
   * target builder but it only considers `@angular-devkit/build-angular:*`
   * builders. Since we are using a custom builder, we patch the context to
   * handle `@nx/angular:*` executors.
   */
  patchBuilderContext(builderContext, isUsingEsbuildBuilder, parsedBuildTarget);

  const { executeExtractI18nBuilder } = await import(
    '@angular-devkit/build-angular'
  );
  const delegateBuilderOptions = getDelegateBuilderOptions(options);

  return await executeExtractI18nBuilder(
    delegateBuilderOptions,
    builderContext
  );
}

function getDelegateBuilderOptions(
  options: ExtractI18nExecutorOptions
): ExtractI18nBuilderOptions {
  const delegateBuilderOptions: ExtractI18nBuilderOptions = { ...options };

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();
  if (angularMajorVersion <= 17) {
    delegateBuilderOptions.browserTarget = delegateBuilderOptions.buildTarget;
    delete delegateBuilderOptions.buildTarget;
  }

  return delegateBuilderOptions;
}
