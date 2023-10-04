import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { storybookVersion } from '../../../utils/versions';
import configurationGenerator from '../../../generators/configuration/configuration';
import {
  createTestUILibNoNgDevkit,
  deleteNewConfigurationAndCreateNew,
} from '../../../utils/testing';
import { migrateDefaultsGenerator } from './migrate-defaults-5-to-6';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

describe('migrate-defaults-5-to-6 Generator', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(appTree, 'package.json', (json) => {
      return {
        ...json,
        devDependencies: {
          ...json.devDependencies,
          '@nrwl/storybook': '10.4.0',
          '@nrwl/workspace': '10.4.0',
          '@storybook/addon-knobs': '^5.3.8',
          '@storybook/angular': '^5.3.8',
          '@storybook/addon-notes': '5.3.21',
          '@storybook/addon-postcss': '2.0.0',
        },
      };
    });
    await createTestUILibNoNgDevkit(appTree, 'test-ui-lib1');
    await createTestUILibNoNgDevkit(appTree, 'test-ui-lib2');

    await configurationGenerator(appTree, {
      name: 'test-ui-lib1',
      uiFramework: '@storybook/react' as any,
    });

    const lib1Configuration = readProjectConfiguration(appTree, 'test-ui-lib1');

    updateProjectConfiguration(appTree, 'test-ui-lib1', {
      ...lib1Configuration,
      targets: {
        ...lib1Configuration.targets,
        storybook: {
          ...lib1Configuration.targets.storybook,
          options: {
            ...lib1Configuration.targets.storybook.options,
            config: {
              configFolder:
                lib1Configuration.targets.storybook.options.configDir,
            },
          },
        },
      },
    });

    appTree = deleteNewConfigurationAndCreateNew(
      appTree,
      'libs/test-ui-lib1/.storybook'
    );

    await configurationGenerator(appTree, {
      name: 'test-ui-lib2',
      uiFramework: '@storybook/react' as any,
    });

    const lib2Configuration = readProjectConfiguration(appTree, 'test-ui-lib2');

    updateProjectConfiguration(appTree, 'test-ui-lib2', {
      ...lib2Configuration,
      targets: {
        ...lib2Configuration.targets,
        storybook: {
          ...lib2Configuration.targets.storybook,
          options: {
            ...lib2Configuration.targets.storybook.options,
            config: {
              configFolder:
                lib2Configuration.targets.storybook.options.configDir,
            },
          },
        },
      },
    });

    appTree = deleteNewConfigurationAndCreateNew(
      appTree,
      'libs/test-ui-lib2/.storybook'
    );

    updateJson(appTree, 'package.json', (json) => {
      return {
        ...json,
        devDependencies: {
          ...json.devDependencies,
          '@storybook/addon-knobs': '^5.3.8',
          '@storybook/angular': '^5.3.8',
        },
      };
    });
  });

  it('should update Storybook packages to latest version and ignore the ones to be ignored', async () => {
    migrateDefaultsGenerator(appTree);

    const packageJson = readJson(appTree, 'package.json');
    expect(packageJson.devDependencies['@storybook/angular']).toEqual(
      storybookVersion
    );
    expect(packageJson.devDependencies['@storybook/addon-knobs']).toEqual(
      storybookVersion
    );
    expect(packageJson.devDependencies['@storybook/addon-notes']).toEqual(
      '5.3.21'
    );
    expect(packageJson.devDependencies['@storybook/addon-postcss']).toEqual(
      '2.0.0'
    );
  });

  it('should update configuration of all projects', async () => {
    migrateDefaultsGenerator(appTree);

    expect(
      appTree.exists('libs/test-ui-lib1/.old_storybook/addons.js')
    ).toBeTruthy();
    expect(
      appTree.exists('libs/test-ui-lib2/.old_storybook/addons.js')
    ).toBeTruthy();

    expect(appTree.exists('libs/test-ui-lib1/.storybook/main.js')).toBeTruthy();
    expect(appTree.exists('libs/test-ui-lib2/.storybook/main.js')).toBeTruthy();
  });

  it('should keep old files and put them in .old_storybook directory', async () => {
    migrateDefaultsGenerator(appTree);
    expect(
      appTree.exists('libs/test-ui-lib1/.old_storybook/addons.js')
    ).toBeTruthy();
    expect(
      appTree.exists('libs/test-ui-lib1/.old_storybook/config.js')
    ).toBeTruthy();

    expect(
      appTree.exists('libs/test-ui-lib2/.old_storybook/addons.js')
    ).toBeTruthy();
    expect(
      appTree.exists('libs/test-ui-lib2/.old_storybook/config.js')
    ).toBeTruthy();
  });
});
