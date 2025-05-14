import { stripIndents, type ProjectConfiguration } from '@nx/devkit';
import type { NormalizedGeneratorOptions } from '../schema';

export function validateBuildTarget(
  options: NormalizedGeneratorOptions,
  project: ProjectConfiguration
): void {
  const buildTarget = project.targets?.[options.buildTarget];

  if (!buildTarget) {
    throw new Error(
      stripIndents`The target "${options.buildTarget}" was not found for project "${options.project}".
      If you are using a different build target, please provide it using the "--buildTarget" option.
      If the project is not a buildable or publishable library, you don't need to setup TailwindCSS for it.`
    );
  }

  const supportedLibraryExecutors = [
    '@angular-devkit/build-angular:ng-packagr',
    '@angular/build:ng-packagr',
    '@nx/angular:ng-packagr-lite',
    '@nx/angular:package',
  ];
  if (
    !supportedLibraryExecutors.includes(
      project.targets[options.buildTarget].executor
    )
  ) {
    throw new Error(
      stripIndents`The build target for project "${
        options.project
      }" is using an unsupported executor "${buildTarget.executor}".
      Supported executors are ${supportedLibraryExecutors
        .map((e) => `"${e}"`)
        .join(', ')}.`
    );
  }
}
