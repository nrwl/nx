import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import * as nxDevkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateBuildTargets } from './update-build-targets';

describe('updateBuildTargets', () => {
  let tree: Tree;
  let schema: NormalizedSchema;

  beforeEach(async () => {
    schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
      importPath: '@proj/subfolder-my-destination',
      updateImportPath: true,
      newProjectName: 'subfolder-my-destination',
      relativeToRootDestination: 'libs/subfolder/my-destination',
    };
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'my-source', {
      root: 'libs/my-source',
      targets: {
        storybook: {
          executor: '@nx/storybook:storybook',
        },
      },
    });
    addProjectConfiguration(tree, 'storybook', {
      root: 'libs/storybook',
      targets: {},
    });
    addProjectConfiguration(tree, 'my-source-e2e', {
      root: 'libs/my-source-e2e',
      targets: {
        e2e: {
          executor: 'test-executor:hi',
          options: {
            devServerTarget: 'my-source:serve',
            browserTarget: 'storybook:serve',
          },
          configurations: {
            production: {
              devServerTarget: 'my-source:serve:production',
            },
          },
        },
      },
    });

    addProjectConfiguration(tree, 'my-flat-source', {
      root: 'my-flat-source',
      name: 'my-flat-source',
      sourceRoot: 'my-flat-source/src',
      projectType: 'application',
      targets: {
        build: {
          cache: true,
          dependsOn: ['^build'],
          inputs: ['production', '^production'],
          executor: '@nx/vite:build',
        },
        serve: {
          executor: '@nx/vite:dev-server',
          defaultConfiguration: 'development',
          options: {
            buildTarget: 'my-flat-source:build:development',
            hmr: true,
          },
          configurations: {
            development: {
              buildTarget: 'my-flat-source:build:development',
              hmr: true,
            },
            production: {
              buildTarget: 'my-flat-source:build:production',
              hmr: false,
            },
          },
        },
      },
    });
  });

  it('should update build targets', async () => {
    updateBuildTargets(tree, schema);

    const e2eProject = readProjectConfiguration(tree, 'my-source-e2e');
    expect(e2eProject).toBeDefined();
    expect(e2eProject.targets.e2e.options.devServerTarget).toBe(
      'subfolder-my-destination:serve'
    );
    expect(
      e2eProject.targets.e2e.configurations.production.devServerTarget
    ).toBe('subfolder-my-destination:serve:production');
  });

  it('should update build targets for flat projects', async () => {
    updateBuildTargets(tree, { ...schema, projectName: 'my-flat-source' });

    const updatedProject = readProjectConfiguration(tree, 'my-flat-source');
    expect(updatedProject).toBeDefined();
    expect(updatedProject.targets.serve.options.buildTarget).toBe(
      'subfolder-my-destination:build:development'
    );
    expect(
      updatedProject.targets.serve.configurations.production.buildTarget
    ).toBe('subfolder-my-destination:build:production');
  });

  it('should NOT update storybook target', async () => {
    schema.projectName = 'storybook';
    updateBuildTargets(tree, schema);

    const myProject = readProjectConfiguration(tree, 'my-source');
    const e2eProject = readProjectConfiguration(tree, 'my-source-e2e');

    expect(myProject).toBeDefined();
    expect(myProject.targets.storybook.executor).toBe(
      '@nx/storybook:storybook'
    );

    expect(e2eProject).toBeDefined();
    expect(e2eProject.targets.e2e.options.browserTarget).toBe(
      'subfolder-my-destination:serve'
    );
  });

  it('should NOT attempt to update unrelated projects', async () => {
    addProjectConfiguration(tree, 'unrelated', { root: 'libs/unrelated' });
    const spy = jest.spyOn(nxDevkit, 'updateProjectConfiguration');
    schema.projectName = 'storybook';
    updateBuildTargets(tree, schema);
    expect(spy.mock.calls.map((x) => x[1])).not.toContain('unrelated');
  });
});
