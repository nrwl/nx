import {
  formatFiles,
  GeneratorCallback,
  getProjects,
  ProjectConfiguration,
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
    for (const [projectName, projectConfig] of projects) {
      if (options.project && options.project !== projectName) {
        continue;
      }
      maybeAddOxlintTarget(
        tree,
        projectName,
        projectConfig,
        options.targetName
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
) {
  if (projectConfig.targets?.[targetName]) {
    return;
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
    return;
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
}

export default convertFromEslintGenerator;
