import { Tree, externalSchematic } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import { createTestUILib } from '../stories/stories-lib.spec';
import { callRule, runSchematic } from '../../utils/testing';
import { storybookVersion } from '../../../../storybook/src/utils/versions';

describe('migrate-defaults-5-to-6 schematic', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib');

    appTree = await callRule(
      updateJsonInTree('package.json', (json) => {
        return {
          ...json,
          devDependencies: {
            ...json.devDependencies,
            '@nrwl/storybook': '10.4.0',
            '@nrwl/workspace': '10.4.0',
            '@storybook/addon-knobs': '^5.3.8',
            '@storybook/angular': '^5.3.8',
          },
        };
      }),
      appTree
    );

    appTree = await runSchematic(
      'storybook-configuration',
      {
        name: 'test-ui-lib',
        configureCypress: false,
        generateCypressSpecs: false,
        generateStories: false,
      },
      appTree
    );
  });

  it('should update the correct dependencies', async () => {
    appTree = await callRule(
      externalSchematic('@nrwl/angular', 'storybook-migrate-defaults-5-to-6', {
        all: true,
      }),
      appTree
    );
    const packageJson = readJsonInTree(appTree, 'package.json');
    // general deps
    expect(packageJson.devDependencies['@storybook/angular']).toEqual(
      storybookVersion
    );
    expect(packageJson.devDependencies['@storybook/addon-knobs']).toEqual(
      storybookVersion
    );
  });

  it('should create the new files', async () => {
    appTree = await callRule(
      externalSchematic('@nrwl/angular', 'storybook-migrate-defaults-5-to-6', {
        all: true,
      }),
      appTree
    );

    expect(appTree.exists('.storybook/addons.js')).toBeTruthy();
    expect(appTree.exists('.old_storybook/addons.js')).toBeTruthy();
    expect(appTree.exists('.storybook/main.js')).toBeTruthy();
    expect(
      appTree.exists('libs/test-ui-lib/.old_storybook/addons.js')
    ).toBeTruthy();
    expect(
      appTree.exists('libs/test-ui-lib/.storybook/addons.js')
    ).toBeTruthy();
    expect(appTree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
  });
});
