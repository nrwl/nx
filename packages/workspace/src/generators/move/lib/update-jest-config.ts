import { ProjectConfiguration, Tree } from '@nx/devkit';
import * as path from 'path';
import { NormalizedSchema } from '../schema';
import { findRootJestConfig } from '../../utils/jest-config';

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
    'jest.config.ts'
  );

  if (tree.exists(jestConfigPath)) {
    const oldContent = tree.read(jestConfigPath, 'utf-8');

    let newContent = oldContent;
    if (schema.projectName !== schema.newProjectName) {
      // ensure both single and double quotes are replaced
      const findName = new RegExp(
        `'${schema.projectName}'|"${schema.projectName}"|\`${schema.projectName}\``,
        'g'
      );
      newContent = oldContent.replace(findName, `'${schema.newProjectName}'`);
    }

    let dirRegex = new RegExp(`\\/${project.root}\\/`, 'g');
    if (dirRegex.test(newContent)) {
      newContent = newContent.replace(
        dirRegex,
        `/${schema.relativeToRootDestination}/`
      );
    }
    dirRegex = new RegExp(`\\/${project.root}['"\`]`, 'g');
    if (dirRegex.test(newContent)) {
      newContent = newContent.replace(
        dirRegex,
        `/${schema.relativeToRootDestination}'`
      );
    }
    dirRegex = new RegExp(`['"\`]${project.root}\\/`, 'g');
    if (dirRegex.test(newContent)) {
      newContent = newContent.replace(
        dirRegex,
        `'${schema.relativeToRootDestination}/`
      );
    }

    tree.write(jestConfigPath, newContent);
  }

  // update root jest.config.ts
  const rootJestConfigPath = findRootJestConfig(tree);

  if (!rootJestConfigPath || !tree.exists(rootJestConfigPath)) {
    return;
  }

  const findProject = `'<rootDir>/${project.root}'`;

  const oldRootJestConfigContent = tree.read(rootJestConfigPath, 'utf-8');
  const usingJestProjects =
    oldRootJestConfigContent.includes('getJestProjects()') ||
    oldRootJestConfigContent.includes('getJestProjectsAsync()');

  const newRootJestConfigContent = oldRootJestConfigContent.replace(
    findProject,
    usingJestProjects ? `` : `'<rootDir>/${schema.relativeToRootDestination}'`
  );

  tree.write(rootJestConfigPath, newRootJestConfigContent);
}
