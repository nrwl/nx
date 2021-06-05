import { formatFiles, Tree } from '@nrwl/devkit';
import { jestConfigObject } from 'packages/jest/src/utils/config/functions';
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
  const fullContents = contentsWithReplaceToken
    .replace('"projects"', 'projects')
    // ^ appears to be needed as formatting does not seem to "take" at least in unit tests?
    .replace(
      `"${REPLACE_TOKEN}"`,
      uncoveredJestProjects.length
        ? `[...getJestProjects(), ${uncoveredJestProjects.map(
            (x, i) =>
              `'${x}'${i === uncoveredJestProjects.length - 1 ? '' : ','}`
          )}]`
        : `getJestProjects()`
    );
  tree.write(baseJestConfigPath, fullContents);
  return;
}

export default async function update(tree: Tree) {
  updateBaseJestConfig(tree);
  await formatFiles(tree);
}
