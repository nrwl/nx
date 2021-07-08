import { formatFiles, Tree } from '@nrwl/devkit';
import { jestConfigObject } from '../../utils/config/functions';
import { getJestProjects } from '../../utils/config/get-jest-projects';

const REPLACE_TOKEN = `$$REPLACE__ME$$`;

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
  return `[...getJestProjects(), ${uncoveredJestProjects.map(
    (projectName) => `'${projectName}', `
  )}]`;
}

function updateBaseJestConfig(
  tree: Tree,
  baseJestConfigPath = 'jest.config.js'
) {
  const currentConfig = jestConfigObject(tree, baseJestConfigPath);
  const uncoveredJestProjects = determineUncoveredJestProjects(
    currentConfig.projects as string[]
  );
  currentConfig.projects = REPLACE_TOKEN as any;
  const contentsWithReplaceToken = `const { getJestProjects } = require('@nrwl/jest');

module.exports = ${JSON.stringify(currentConfig, null, 2)};
`;
  const fullContents = contentsWithReplaceToken.replace(
    `"${REPLACE_TOKEN}"`,
    determineProjectsValue(uncoveredJestProjects)
  );
  tree.write(baseJestConfigPath, fullContents);
  return;
}

export default async function update(tree: Tree) {
  updateBaseJestConfig(tree);
  await formatFiles(tree);
}
