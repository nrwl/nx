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
    let sawEslintTarget = false;
    for (const [projectName, projectConfig] of projects) {
      if (options.project && options.project !== projectName) {
        continue;
      }
      const result = maybeAddOxlintTarget(
        tree,
        projectName,
        projectConfig,
        options.targetName
      );
      if (result !== 'no-eslint-target') {
        sawEslintTarget = true;
      }
      // 'already-oxlint' stays silent — that is idempotence on a re-run. Only a
      // name held by something else means the user's request was dropped.
      if (result === 'name-taken') {
        logger.warn(
          `Did not add an Oxlint target to "${projectName}": a "${options.targetName}" target already exists ` +
            `and does not use @nx/oxlint:lint. Pass --targetName to choose another name.`
        );
      }
    }

    if (!sawEslintTarget) {
      // `getProjects` reads the tree, so it never sees targets that come from
      // `@nx/eslint/plugin` inference — which is the default. Saying nothing
      // here reports success for a run that added no targets at all.
      //
      // Keyed on whether any project had an explicit ESLint target, not on how
      // many were converted: a re-run converts nothing and would otherwise
      // claim there was no ESLint target when there plainly is one.
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

/**
 * Why four outcomes rather than a boolean: "nothing happened" has three causes
 * that need different reporting — nothing to convert, already converted, and
 * the requested name being held by something else. Collapsing them is what made
 * a re-run claim no ESLint target existed and a skipped project say nothing.
 */
type ConversionOutcome =
  | 'added'
  | 'already-oxlint'
  | 'name-taken'
  | 'no-eslint-target';

function maybeAddOxlintTarget(
  tree: Tree,
  projectName: string,
  projectConfig: ProjectConfiguration,
  targetName: string
): ConversionOutcome {
  const eslintTarget =
    projectConfig.targets?.lint?.executor === '@nx/eslint:lint'
      ? projectConfig.targets.lint
      : Object.values(projectConfig.targets ?? {}).find(
          (target) =>
            target.executor === '@nx/eslint:lint' ||
            target.executor === '@nrwl/linter:eslint'
        );

  // Checked before the name, so a project with nothing to convert never reports
  // as "name taken".
  if (!eslintTarget) {
    return 'no-eslint-target';
  }

  const occupying = projectConfig.targets?.[targetName];
  if (occupying) {
    return occupying.executor === '@nx/oxlint:lint'
      ? 'already-oxlint'
      : 'name-taken';
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
  return 'added';
}

export default convertFromEslintGenerator;
