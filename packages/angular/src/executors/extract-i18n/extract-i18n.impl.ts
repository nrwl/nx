import { parseTargetString, type ExecutorContext } from '@nx/devkit';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { readCachedProjectConfiguration } from 'nx/src/project-graph/project-graph';
import { patchBuilderContext } from '../utilities/patch-builder-context';
import type { ExtractI18nExecutorOptions } from './schema';

export default async function* extractI18nExecutor(
  options: ExtractI18nExecutorOptions,
  context: ExecutorContext
) {
  const parsedBuildTarget = parseTargetString(options.buildTarget, context);
  const buildTargetProjectConfiguration = readCachedProjectConfiguration(
    parsedBuildTarget.project
  );

  const buildTarget =
    buildTargetProjectConfiguration.targets[parsedBuildTarget.target];

  const isUsingEsbuildBuilder = [
    '@angular/build:application',
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

  return await executeExtractI18nBuilder(options, builderContext);
}
