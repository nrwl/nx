import {
  joinPathFragments,
  ProjectConfiguration,
  stripIndents,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { NormalizedGeneratorOptions } from '../schema';

export function addTailwindConfigPathToProject(
  tree: Tree,
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
    '@nrwl/angular:ng-packagr-lite',
    '@nrwl/angular:package',
  ];
  if (!supportedLibraryExecutors.includes(buildTarget.executor)) {
    throw new Error(
      stripIndents`The build target for project "${
        options.project
      }" is using an unsupported executor "${buildTarget.executor}".
      Supported executors are ${supportedLibraryExecutors
        .map((e) => `"${e}"`)
        .join(', ')}.`
    );
  }

  if (
    buildTarget.options?.tailwindConfig &&
    tree.exists(buildTarget.options.tailwindConfig)
  ) {
    throw new Error(
      stripIndents`The "${buildTarget.options.tailwindConfig}" file is already configured for the project "${options.project}". Are you sure this is the right project to set up Tailwind?
      If you are sure, you can remove the configuration and re-run the generator.`
    );
  }

  buildTarget.options = {
    ...buildTarget.options,
    tailwindConfig: joinPathFragments(project.root, 'tailwind.config.js'),
  };

  updateProjectConfiguration(tree, options.project, project);
}
