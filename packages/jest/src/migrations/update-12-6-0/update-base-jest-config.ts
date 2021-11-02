import { formatFiles, Tree } from '@nrwl/devkit';
import { jestConfigObject } from '../../utils/config/functions';
import { getJestProjects } from '../../utils/config/get-jest-projects';
import {
  addImportStatementToJestConfig,
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '../../utils/config/update-config';

function determineUncoveredJestProjects(existingProjects: string[]) {
  const coveredJestProjects = (getJestProjects() as string[]).reduce(
    (acc, key) => {
      acc[key] = true;
      return acc;
    },
    {}
  );
  return existingProjects.filter((project) => !coveredJestProjects[project]);
}

function determineProjectsValue(uncoveredJestProjects: string[]): string {
  if (!uncoveredJestProjects.length) {
    return `getJestProjects()`;
  }
  return `[...getJestProjects(), ${uncoveredJestProjects
    .map((projectName) => `'${projectName}', `)
    .join('')}]`;
}

function updateBaseJestConfig(
  tree: Tree,
  baseJestConfigPath = 'jest.config.js'
) {
  if (tree.read('/jest.config.js', 'utf-8').includes('getJestProjects()')) {
    return;
  }
  const currentConfig = jestConfigObject(tree, baseJestConfigPath);
  currentConfig.projects ??= [];

  const uncoveredJestProjects = determineUncoveredJestProjects(
    currentConfig.projects as string[]
  );
  removePropertyFromJestConfig(tree, baseJestConfigPath, 'projects');
  addPropertyToJestConfig(
    tree,
    baseJestConfigPath,
    'projects',
    determineProjectsValue(uncoveredJestProjects),
    { valueAsString: true }
  );
  addImportStatementToJestConfig(
    tree,
    baseJestConfigPath,
    `const { getJestProjects } = require('@nrwl/jest');`
  );
  return;
}

export default async function update(tree: Tree) {
  updateBaseJestConfig(tree);
  await formatFiles(tree);
}
