import type { ProjectConfiguration, ProjectGraph, Tree } from '@nx/devkit';
import { addProjectConfiguration, logger } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import migration from './warn-incompatible-angular-cypress';

jest.mock('nx/src/utils/package-json');
let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));

describe('warn-incompatible-angular-cypress migration', () => {
  let tree: Tree;
  let mockReadModulePackageJson: jest.Mock<
    ReturnType<typeof readModulePackageJson>
  > = readModulePackageJson as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    jest.resetAllMocks();
  });

  it('should not warn when Angular is not installed', async () => {
    mockReadModulePackageJson.mockReturnValue(null);
    addProject(
      tree,
      'app1',
      {
        root: 'apps/app1',
        targets: {
          'component-test': {
            executor: '@nx/cypress:cypress',
            options: {
              testingType: 'component',
            },
          },
        },
      },
      ['npm:react']
    );
    const loggerSpy = jest.spyOn(logger, 'warn');

    await migration(tree);

    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it('should not warn when Angular version is lower than 16.1.0', async () => {
    mockReadModulePackageJson.mockReturnValue({
      packageJson: { name: '@angular/core', version: '16.0.0' },
      path: '',
    });
    addProject(
      tree,
      'app1',
      {
        root: 'apps/app1',
        targets: {
          'component-test': {
            executor: '@nx/cypress:cypress',
            options: {
              testingType: 'component',
            },
          },
        },
      },
      ['npm:@angular/core']
    );
    const loggerSpy = jest.spyOn(logger, 'warn');

    await migration(tree);

    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it('should not warn when there are no Angular projects', async () => {
    mockReadModulePackageJson.mockReturnValue({
      packageJson: { name: '@angular/core', version: '16.1.0' },
      path: '',
    });
    addProject(
      tree,
      'app1',
      {
        root: 'apps/app1',
        targets: {
          'component-test': {
            executor: '@nx/cypress:cypress',
            options: {
              testingType: 'component',
            },
          },
        },
      },
      ['npm:react']
    );
    const loggerSpy = jest.spyOn(logger, 'warn');

    await migration(tree);

    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it('should not warn when the Angular projects are not using Cypress Component Testing', async () => {
    mockReadModulePackageJson.mockReturnValue({
      packageJson: { name: '@angular/core', version: '16.1.0' },
      path: '',
    });
    addProject(
      tree,
      'app1',
      {
        root: 'apps/app1',
        targets: {
          'component-test': {
            executor: '@nx/cypress:cypress',
            options: {
              testingType: 'component',
            },
          },
        },
      },
      ['npm:react']
    );
    addProject(
      tree,
      'app2',
      {
        root: 'apps/app2',
        targets: {
          e2e: {
            executor: '@nx/cypress:cypress',
            options: {
              testingType: 'e2e',
            },
          },
        },
      },
      ['npm:@angular/core']
    );
    const loggerSpy = jest.spyOn(logger, 'warn');

    await migration(tree);

    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it('should warn when there is an Angular project using Cypress Component Testing', async () => {
    mockReadModulePackageJson.mockReturnValue({
      packageJson: { name: '@angular/core', version: '16.1.0' },
      path: '',
    });
    addProject(
      tree,
      'app1',
      {
        root: 'apps/app1',
        targets: {
          'component-test': {
            executor: '@nx/cypress:cypress',
            options: {
              testingType: 'component',
            },
          },
        },
      },
      ['npm:@angular/core']
    );
    const loggerSpy = jest.spyOn(logger, 'warn');

    await migration(tree);

    expect(loggerSpy).toHaveBeenCalled();
  });

  it('should warn only once when there are multiple Angular projects using Cypress Component Testing', async () => {
    mockReadModulePackageJson.mockReturnValue({
      packageJson: { name: '@angular/core', version: '16.1.0' },
      path: '',
    });
    addProject(
      tree,
      'app1',
      {
        root: 'apps/app1',
        targets: {
          'component-test': {
            executor: '@nx/cypress:cypress',
            options: {
              testingType: 'component',
            },
          },
        },
      },
      ['npm:@angular/core']
    );
    addProject(
      tree,
      'app2',
      {
        root: 'apps/app2',
        targets: {
          e2e: {
            executor: '@nx/cypress:cypress',
            options: {
              testingType: 'component',
            },
          },
        },
      },
      ['npm:@angular/core']
    );
    const loggerSpy = jest.spyOn(logger, 'warn');

    await migration(tree);

    expect(loggerSpy).toHaveBeenCalledTimes(1);
  });
});

function addProject(
  tree: Tree,
  projectName: string,
  config: ProjectConfiguration,
  dependencies: string[]
): void {
  projectGraph = {
    dependencies: {
      [projectName]: dependencies.map((d) => ({
        source: projectName,
        target: d,
        type: 'static',
      })),
    },
    nodes: {
      [projectName]: { data: config, name: projectName, type: 'app' },
    },
  };
  addProjectConfiguration(tree, projectName, config);
}
