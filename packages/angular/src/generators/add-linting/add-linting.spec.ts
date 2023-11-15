import type { ProjectConfiguration, Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as linter from '@nx/eslint';
import { addLintingGenerator } from './add-linting';

describe('addLinting generator', () => {
  let tree: Tree;
  const appProjectName = 'ng-app1';
  const appProjectRoot = `apps/${appProjectName}`;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    addProjectConfiguration(tree, appProjectName, {
      root: appProjectRoot,
      prefix: 'myOrg',
      projectType: 'application',
      targets: {},
    } as ProjectConfiguration);
  });

  it('should invoke the lintProjectGenerator', async () => {
    jest.spyOn(linter, 'lintProjectGenerator');

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
    });

    expect(linter.lintProjectGenerator).toHaveBeenCalled();
  });

  it('should add the Angular specific EsLint devDependencies', async () => {
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@angular-eslint/eslint-plugin']).toBeDefined();
    expect(
      devDependencies['@angular-eslint/eslint-plugin-template']
    ).toBeDefined();
    expect(devDependencies['@angular-eslint/template-parser']).toBeDefined();
  });

  it('should correctly generate the .eslintrc.json file', async () => {
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    expect(eslintConfig).toMatchSnapshot();
  });

  it('should update the project with the right lint target configuration', async () => {
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
    });

    const project = readProjectConfiguration(tree, appProjectName);
    expect(project.targets.lint).toEqual({
      executor: '@nx/eslint:lint',
      options: {
        lintFilePatterns: [
          `${appProjectRoot}/**/*.ts`,
          `${appProjectRoot}/**/*.html`,
        ],
      },
      outputs: ['{options.outputFile}'],
    });
  });
});
