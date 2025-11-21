import type { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import type {
  ApplicationBuilderOptions,
  NgPackagrBuilderOptions,
} from '@angular/build';
import type { ExecutorContext, Target } from '@nx/devkit';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { targetFromTargetString } from '../../utils/targets';
import type { ApplicationExecutorOptions } from '../application/schema';
import type { BuildAngularLibraryExecutorOptions } from '../package/schema';
import { getInstalledAngularVersionInfo } from '../utilities/angular-version-utils';
import { assertBuilderPackageIsInstalled } from '../utilities/builder-package';
import {
  loadIndexHtmlTransformer,
  loadPlugins,
} from '../utilities/esbuild-extensions';
import type { UnitTestExecutorOptions } from './schema';

export default async function* unitTestExecutor(
  options: UnitTestExecutorOptions,
  context: ExecutorContext
): AsyncIterable<BuilderOutput> {
  validateOptions();

  const {
    plugins: pluginPaths,
    indexHtmlTransformer: indexHtmlTransformerPath,
    ...delegateExecutorOptions
  } = options;

  const plugins = await loadPlugins(pluginPaths, options.tsConfig);
  const indexHtmlTransformer = indexHtmlTransformerPath
    ? await loadIndexHtmlTransformer(indexHtmlTransformerPath, options.tsConfig)
    : undefined;

  const builderContext = await createBuilderContext(
    {
      builderName: 'unit-test',
      description: 'Run application unit tests.',
      optionSchema: require('./schema.json'),
    },
    context
  );

  const buildTargetSpecifier = options.buildTarget ?? `::development`;
  const buildTarget = targetFromTargetString(
    buildTargetSpecifier,
    context.projectName,
    'build'
  );
  patchBuilderContext(builderContext, buildTarget);

  assertBuilderPackageIsInstalled('@angular/build');
  const { executeUnitTestBuilder } = await import('@angular/build');
  return yield* executeUnitTestBuilder(
    delegateExecutorOptions,
    builderContext,
    {
      codePlugins: plugins,
      indexHtmlTransformer,
    }
  );
}

function validateOptions(): void {
  const { version: angularVersion, major: angularMajorVersion } =
    getInstalledAngularVersionInfo();

  if (angularMajorVersion < 21) {
    throw new Error(
      `The "unit-test" executor is only available for Angular versions >= 21.0.0. You are currently using version ${angularVersion}.`
    );
  }
}

/**
 * The Angular CLI unit-test builder only accepts the `@angular/build:application`
 * and `@angular/build:ng-packagr` builders. We need to patch the builder context
 * so that it accepts the `@nx/angular:*` executors.
 *
 * https://github.com/angular/angular-cli/blob/f9de11d67d3e0e0524372819583bc77756596d4f/packages/angular/build/src/builders/unit-test/builder.ts#L246-L262
 */
function patchBuilderContext(context: BuilderContext, buildTarget: Target) {
  const executorToBuilderMap = new Map<string, string>([
    ['@nx/angular:application', '@angular/build:application'],
    ['@nx/angular:ng-packagr-lite', '@angular/build:ng-packagr'],
    ['@nx/angular:package', '@angular/build:ng-packagr'],
  ]);

  const originalGetBuilderNameForTarget = context.getBuilderNameForTarget;
  context.getBuilderNameForTarget = async (target) => {
    const builderName = await originalGetBuilderNameForTarget(target);

    if (executorToBuilderMap.has(builderName)) {
      return executorToBuilderMap.get(builderName)!;
    }

    return builderName;
  };

  const originalGetTargetOptions = context.getTargetOptions;
  context.getTargetOptions = async (target) => {
    const options = await originalGetTargetOptions(target);

    if (
      target.project === buildTarget.project &&
      target.target === buildTarget.target &&
      target.configuration === buildTarget.configuration
    ) {
      cleanBuildTargetOptions(options);
    }

    return options;
  };
}

function cleanBuildTargetOptions(
  options: ApplicationExecutorOptions | BuildAngularLibraryExecutorOptions
): ApplicationBuilderOptions | NgPackagrBuilderOptions {
  if (
    'buildLibsFromSource' in options ||
    'indexHtmlTransformer' in options ||
    'plugins' in options
  ) {
    delete options.buildLibsFromSource;
    delete options.indexHtmlTransformer;
    delete options.plugins;
  }

  return options;
}
