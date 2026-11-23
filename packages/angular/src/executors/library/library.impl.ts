import type { BuilderOutput, ScheduleOptions } from '@angular-devkit/architect';
import type { WorkspaceHost } from '@angular-devkit/architect/node';
import type { ExecutorContext } from '@nx/devkit';
import { eachValueFrom } from '@nx/devkit/internal';
import { createBuilderContext } from '@nx/devkit/ngcli-adapter';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
} from '@nx/js/internal';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { lt } from 'semver';
import { getInstalledPackageVersionInfo } from '../utilities/angular-version-utils';
import { assertPackageIsInstalled } from '../utilities/builder-package';
import type { LibraryExecutorOptions } from './schema';

const libraryBuilderName = '@angular/build:library';

export default async function* libraryExecutor(
  options: LibraryExecutorOptions,
  context: ExecutorContext
): AsyncGenerator<BuilderOutput> {
  assertLibraryBuilderIsAvailable();

  const { dependencies } = calculateProjectBuildableDependencies(
    context.taskGraph,
    context.projectGraph,
    context.root,
    context.projectName,
    context.targetName,
    context.configurationName
  );
  // The generated tsconfig fixes `paths` at startup, so use it only when a
  // dependency has outputs to remap.
  const builderOptions: LibraryExecutorOptions = dependencies.some(
    (dependency) => dependency.outputs.length > 0
  )
    ? {
        ...options,
        tsConfig: createTmpTsConfig(
          join(context.root, options.tsConfig),
          context.root,
          context.projectsConfigurations.projects[context.projectName].root,
          dependencies
        ),
      }
    : options;

  const nxBuilderContext = await createBuilderContext(
    {
      builderName: '@nx/angular:library',
      description: 'Build an Angular library.',
      optionSchema: require('./schema.json'),
    },
    context
  );

  // `@angular/build` doesn't export the library builder, so run it through
  // Architect with the copy `@angular/build` depends on.
  const architectRequire = createRequire(
    require.resolve('@angular-devkit/architect/package.json', {
      paths: [require.resolve('@angular/build/package.json')],
    })
  );
  const { Architect } = architectRequire(
    '@angular-devkit/architect'
  ) as typeof import('@angular-devkit/architect');
  const { WorkspaceNodeModulesArchitectHost } = architectRequire(
    '@angular-devkit/architect/node'
  ) as typeof import('@angular-devkit/architect/node');
  const { schema } = architectRequire(
    '@angular-devkit/core'
  ) as typeof import('@angular-devkit/core');

  // Architect only asks about the target it schedules, and the builder only
  // reads that project's metadata.
  const workspaceHost: WorkspaceHost = {
    getBuilderName: async () => libraryBuilderName,
    getMetadata: (project) => nxBuilderContext.getProjectMetadata(project),
    getOptions: async () => builderOptions as any,
    hasTarget: async () => true,
    // The options Nx passes already include the requested configuration.
    getDefaultConfigurationName: async () => undefined,
  };

  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedObjectDefaults);
  const architect = new Architect(
    new WorkspaceNodeModulesArchitectHost(workspaceHost, context.root),
    registry
  );

  const run = await architect.scheduleTarget(
    { project: context.projectName, target: context.targetName },
    {},
    // Architect calls `next`, which `LoggerApi` lacks; the adapter's logger is a `Logger`.
    { logger: nxBuilderContext.logger as unknown as ScheduleOptions['logger'] }
  );
  try {
    if (options.watch) {
      yield* eachValueFrom(run.output);
    } else {
      yield await run.lastOutput;
    }
  } finally {
    await run.stop();
  }
}

function assertLibraryBuilderIsAvailable(): void {
  assertPackageIsInstalled('@angular/build', '@nx/angular:library');

  const { version } = getInstalledPackageVersionInfo('@angular/build');
  if (lt(version, '22.3.0')) {
    throw new Error(
      `The "library" executor requires "@angular/build" version 22.3.0 or greater. You are currently using version ${version}.`
    );
  }
}
