import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { allProjectTargets } from '../../utils/targets';
import { getProjectsFilteredByDependencies } from '../utils/projects';

const buildExecutors = new Set([
  '@nx/angular:ng-packagr-lite',
  '@nx/angular:package',
]);
const testExecutors = new Set(['@nx/jest:jest']);

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/core',
  ]);

  for (const project of projects) {
    try {
      // we're only updating static project configurations, not inferred ones
      const projectConfig = readProjectConfiguration(tree, project.name);
      for (const target of relevantTargets(projectConfig)) {
        updateTarget(tree, projectConfig, target);
      }
      updateProjectConfiguration(tree, project.name, projectConfig);
    } catch {
      // ignore, it can happen if the project is fully inferred and there's no
      // `project.json` file or `nx` entry in `package.json`
    }
  }

  await formatFiles(tree);
}

function updateTarget(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  target: TargetConfiguration
) {
  if (buildExecutors.has(target.executor)) {
    if (target.configurations?.['development']?.tsConfig) {
      // only set the option if the target has the expected tsConfig option in
      // the development configuration
      target.options ??= {};
      target.options.tsConfig = target.configurations['development'].tsConfig;
      // remove tsConfig from development configuration after moving it to options
      delete target.configurations['development'].tsConfig;
    }
  } else if (testExecutors.has(target.executor)) {
    const expectedTsconfigPath = joinPathFragments(
      projectConfig.root,
      'tsconfig.spec.json'
    );
    if (tree.exists(expectedTsconfigPath)) {
      // we keep it simple and only set the option if the expected tsconfig
      // file exists
      target.options ??= {};
      target.options.tsConfig = expectedTsconfigPath;
    }
  }
}

function* relevantTargets(
  project: ProjectConfiguration
): Iterable<TargetConfiguration> {
  for (const [, target] of allProjectTargets(project)) {
    if (
      !buildExecutors.has(target.executor) &&
      !testExecutors.has(target.executor)
    ) {
      continue;
    }

    if (!target.options?.['tsConfig']) {
      yield target;
    }
  }
}
