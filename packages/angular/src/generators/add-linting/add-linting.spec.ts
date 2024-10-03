import 'nx/src/internal-testing-utils/mock-project-graph';
import {
  ProjectConfiguration,
  Tree,
  addProjectConfiguration,
  readJson,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as linter from '@nx/eslint';
import { addLintingGenerator } from './add-linting';
import { eslint9__eslintVersion } from '@nx/eslint/src/utils/versions';

jest.mock('nx/src/devkit-internals', () => ({
  ...jest.requireActual<any>('nx/src/devkit-internals'),
  readModulePackageJson: jest.fn().mockImplementation((module, extras) => {
    if (module === 'eslint') {
      return {
        packageJson: {
          version: '9.8.0',
        },
      };
    } else {
      return jest
        .requireActual<any>('nx/src/devkit-internals')
        .readModulePackageJson(module, extras);
    }
  }),
}));

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
      skipFormat: true,
    });

    expect(linter.lintProjectGenerator).toHaveBeenCalled();
  });

  it('should add the Angular specific EsLint devDependencies', async () => {
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@angular-eslint/eslint-plugin']).toBeDefined();
    expect(
      devDependencies['@angular-eslint/eslint-plugin-template']
    ).toBeDefined();
    expect(devDependencies['@angular-eslint/template-parser']).toBeDefined();
  });

  it('should use flat config and install correct dependencies when using it', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies['eslint'] = eslint9__eslintVersion;
      return json;
    });

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['@typescript-eslint/utils']).toMatchInlineSnapshot(
      `"^8.0.0"`
    );
  });

  it('should correctly generate the .eslintrc.json file', async () => {
    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
    });

    const eslintConfig = readJson(tree, `${appProjectRoot}/.eslintrc.json`);
    expect(eslintConfig).toMatchSnapshot();
  });

  it('should not touch the package.json when run with `--skipPackageJson`', async () => {
    let initialPackageJson;
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = {};
      json.devDependencies = {};
      initialPackageJson = json;

      return json;
    });

    await addLintingGenerator(tree, {
      prefix: 'myOrg',
      projectName: appProjectName,
      projectRoot: appProjectRoot,
      skipFormat: true,
      skipPackageJson: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual(initialPackageJson);
  });
});
