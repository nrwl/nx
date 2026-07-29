import {
  formatFiles,
  GeneratorCallback,
  getProjects,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { initGenerator } from '../init/init.js';

export interface ConvertFromEslintSchema {
  project?: string;
  targetName?: string;
  addExplicitTargets?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
}

export async function convertFromEslintGenerator(
  tree: Tree,
  options: ConvertFromEslintSchema
) {
  // Sits beside an existing ESLint `lint` target, so it never claims `lint`.
  options.targetName ??= 'oxlint';
  options.addExplicitTargets ??= true;

  // Throws the standard devkit "Cannot find configuration for ..." error. Without
  // it a typo'd name matches nothing, every iteration below is skipped, and the
  // generator reports success having done nothing.
  if (options.project) {
    readProjectConfiguration(tree, options.project);
  }

  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await initGenerator(tree, {
      addPlugin: true,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      keepExistingVersions: options.keepExistingVersions,
    })
  );

  if (options.addExplicitTargets) {
    const projects = getProjects(tree);
    let converted = 0;
    for (const [projectName, projectConfig] of projects) {
      if (options.project && options.project !== projectName) {
        continue;
      }
      if (
        maybeAddOxlintTarget(
          tree,
          projectName,
          projectConfig,
          options.targetName
        )
      ) {
        converted++;
      }
    }

    if (!converted) {
      // `getProjects` reads the tree, so it never sees targets that come from
      // `@nx/eslint/plugin` inference — which is the default. Saying nothing
      // here reports success for a run that added no targets at all.
      logger.warn(
        `Did not add any explicit Oxlint targets: no project has an explicit @nx/eslint:lint target. ` +
          `Projects that get their lint target from @nx/eslint/plugin will get an inferred Oxlint target instead, ` +
          `now that @nx/oxlint is registered.`
      );
    }
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function maybeAddOxlintTarget(
  tree: Tree,
  projectName: string,
  projectConfig: ProjectConfiguration,
  targetName: string
): boolean {
  if (projectConfig.targets?.[targetName]) {
    return false;
  }

  const eslintTarget =
    projectConfig.targets?.lint?.executor === '@nx/eslint:lint'
      ? projectConfig.targets.lint
      : Object.values(projectConfig.targets ?? {}).find(
          (target) =>
            target.executor === '@nx/eslint:lint' ||
            target.executor === '@nrwl/linter:eslint'
        );

  if (!eslintTarget) {
    return false;
  }

  const lintFilePatterns = eslintTarget.options?.lintFilePatterns ?? [
    '{projectRoot}',
  ];

  projectConfig.targets ??= {};
  projectConfig.targets[targetName] = {
    executor: '@nx/oxlint:lint',
    options: {
      lintFilePatterns,
    },
  };

  updateProjectConfiguration(tree, projectName, projectConfig);
  return true;
}

export default convertFromEslintGenerator;
