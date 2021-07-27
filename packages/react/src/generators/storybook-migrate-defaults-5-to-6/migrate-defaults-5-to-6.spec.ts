import { createTestUILib } from '../stories/stories-lib.spec';
import { storybookVersion } from '@nrwl/storybook';
import { logger, readJson, Tree, updateJson } from '@nrwl/devkit';
import storybookConfigurationGenerator from '../storybook-configuration/configuration';
import { storybookMigration5to6Generator } from '@nrwl/react';

describe('migrate-defaults-5-to-6 schematic', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib');

    updateJson(appTree, 'package.json', (json) => {
      return {
        ...json,
        devDependencies: {
          ...json.devDependencies,
          '@nrwl/storybook': '10.4.0',
          '@nrwl/workspace': '10.4.0',
          '@storybook/addon-knobs': '^5.3.8',
          '@storybook/react': '^5.3.8',
        },
      };
    });

    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-lib',
      configureCypress: false,
      generateCypressSpecs: false,
      generateStories: false,
      standaloneConfig: false,
    });

    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should update the correct dependencies', async () => {
    storybookMigration5to6Generator(appTree, { all: true });
    const packageJson = readJson(appTree, 'package.json');
    // general deps
    expect(packageJson.devDependencies['@storybook/react']).toEqual(
      storybookVersion
    );
    expect(packageJson.devDependencies['@storybook/addon-knobs']).toEqual(
      storybookVersion
    );
  });
});
