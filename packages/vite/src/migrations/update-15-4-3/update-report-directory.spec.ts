import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateReportDirectoryPlaceholders } from './update-report-directory';

describe('Update Report Directory Vitest Migration', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should migrate', () => {
    addVitestProjects(tree, { name: 'project' });

    updateReportDirectoryPlaceholders(tree);
    expect(readProjectConfiguration(tree, 'project-one').targets)
      .toMatchInlineSnapshot(`
      {
        "test": {
          "executor": "@nrwl/vite:test",
          "options": {
            "passWithNoTests": true,
            "reportsDirectory": "../../coverge/packages/project-one",
          },
          "outputs": [
            "coverage/packages/project-one",
          ],
        },
      }
    `);
    expect(readProjectConfiguration(tree, 'project-two').targets)
      .toMatchInlineSnapshot(`
      {
        "custom-test": {
          "configurations": {
            "ci": {
              "reportsDirectory": "coverge/project-two",
            },
          },
          "executor": "@nrwl/vite:test",
          "options": {
            "passWithNoTests": true,
          },
          "outputs": [
            "coverage/project-two",
            "dist/coverage/else.txt",
          ],
        },
        "test": {
          "executor": "@nrwl/vite:test",
          "options": {
            "passWithNoTests": true,
            "reportsDirectory": "coverge/project-two",
          },
        },
      }
    `);
  });
  it('should be idempotent', () => {
    addVitestProjects(tree, { name: 'project' });

    const expectedProjectOneConfig = {
      test: {
        outputs: ['coverage/packages/project-one'],
        executor: '@nrwl/vite:test',
        options: {
          reportsDirectory: '../../coverge/packages/project-one',
          passWithNoTests: true,
        },
      },
    };

    const expectedProjectTwoConfig = {
      'custom-test': {
        executor: '@nrwl/vite:test',
        outputs: ['coverage/project-two', 'dist/coverage/else.txt'],
        options: {
          passWithNoTests: true,
        },
        configurations: {
          ci: {
            reportsDirectory: 'coverge/project-two',
          },
        },
      },
      test: {
        executor: '@nrwl/vite:test',
        options: {
          reportsDirectory: 'coverge/project-two',
          passWithNoTests: true,
        },
      },
    };

    updateReportDirectoryPlaceholders(tree);
    const projOneConfig = readProjectConfiguration(tree, 'project-one');
    expect(projOneConfig.targets).toEqual(expectedProjectOneConfig);
    const projTwoConfig = readProjectConfiguration(tree, 'project-two');
    expect(projTwoConfig.targets).toEqual(expectedProjectTwoConfig);
  });
});

function addVitestProjects(tree: Tree, options: { name: string }) {
  addProjectConfiguration(tree, options.name + '-one', {
    name: options.name + '-one',
    sourceRoot: `packages/${options.name}-one/src`,
    root: `packages/${options.name}-one`,
    targets: {
      test: {
        outputs: ['{projectRoot}/coverage'],
        executor: '@nrwl/vite:test',
        options: {
          reportsDirectory: '{workspaceRoot}/coverge/{projectRoot}',
          passWithNoTests: true,
        },
      },
    },
  });
  addProjectConfiguration(tree, options.name + '-two', {
    name: options.name + '-two',
    sourceRoot: 'src',
    root: '.',
    targets: {
      'custom-test': {
        executor: '@nrwl/vite:test',
        outputs: ['{projectRoot}/coverage', 'dist/coverage/else.txt'],
        options: {
          passWithNoTests: true,
        },
        configurations: {
          ci: {
            reportsDirectory: '{workspaceRoot}/coverge/{projectRoot}',
          },
        },
      },
      test: {
        executor: '@nrwl/vite:test',
        options: {
          reportsDirectory: '{workspaceRoot}/coverge/{projectRoot}',
          passWithNoTests: true,
        },
      },
    },
  });
}
