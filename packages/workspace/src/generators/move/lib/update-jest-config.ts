import { ProjectConfiguration, Tree } from '@nrwl/devkit';
import * as path from 'path';
import { NormalizedSchema } from '../schema';

/**
 * Updates the project name and coverage folder in the jest.config.js if it exists
 *
 * (assume relative paths have been updated previously)
 *
 * @param schema The options provided to the schematic
 */
export function updateJestConfig(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  const jestConfigPath = path.join(
    schema.relativeToRootDestination,
    'jest.config.js'
  );

  if (tree.exists(jestConfigPath)) {
    const oldContent = tree.read(jestConfigPath, 'utf-8');

    const findName = new RegExp(`'${schema.projectName}'`, 'g');
    const findDir = new RegExp(project.root, 'g');

    const newContent = oldContent
      .replace(findName, `'${schema.newProjectName}'`)
      .replace(findDir, schema.relativeToRootDestination);
    tree.write(jestConfigPath, newContent);
  }

  // update root jest.config.js
  const rootJestConfigPath = '/jest.config.js';

  if (!tree.exists(rootJestConfigPath)) {
    return;
  }

  const findProject = `'<rootDir>/${project.root}'`;

  const oldRootJestConfigContent = tree.read(rootJestConfigPath, 'utf-8');
  const usingJestProjects =
    oldRootJestConfigContent.includes('getJestProjects()');

  const newRootJestConfigContent = oldRootJestConfigContent.replace(
    findProject,
    usingJestProjects ? `` : `'<rootDir>/${schema.relativeToRootDestination}'`
  );

  tree.write(rootJestConfigPath, newRootJestConfigContent);
}
