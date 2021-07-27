import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, readJson, updateJson } from '@nrwl/devkit';
import { overrideCollectionResolutionForTesting } from '@nrwl/devkit/ngcli-adapter';
import { Linter } from '@nrwl/linter';
import { storybookVersion } from '../../../../storybook/src/utils/versions';
import storybookConfigurationGenerator from '../storybook-configuration/storybook-configuration';
import { createStorybookTestWorkspaceForLib } from '../utils/testing';
import { storybookMigrateDefaults5To6Generator } from './storybook-migrate-defaults-5-to-6';

describe('storybookMigrateDefaults5To6 generator', () => {
  let tree: Tree;
  const libName = 'test-ui-lib';

  beforeEach(async () => {
    overrideCollectionResolutionForTesting({
      '@nrwl/storybook': joinPathFragments(
        __dirname,
        '../../../../storybook/generators.json'
      ),
    });

    tree = await createStorybookTestWorkspaceForLib(libName);

    updateJson(tree, 'package.json', (json) => {
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
    });

    await storybookConfigurationGenerator(tree, {
      name: libName,
      configureCypress: false,
      generateCypressSpecs: false,
      generateStories: false,
      linter: Linter.EsLint,
    });
  });

  it('should update the correct dependencies', () => {
    storybookMigrateDefaults5To6Generator(tree, { all: true });

    const packageJson = readJson(tree, 'package.json');
    // general deps
    expect(packageJson.devDependencies['@storybook/angular']).toEqual(
      storybookVersion
    );
    expect(packageJson.devDependencies['@storybook/addon-knobs']).toEqual(
      storybookVersion
    );
  });

  it('should create the new files', () => {
    storybookMigrateDefaults5To6Generator(tree, { all: true });

    expect(tree.exists('.old_storybook/addons.js')).toBeTruthy();
    expect(tree.exists('.storybook/main.js')).toBeTruthy();
    expect(
      tree.exists(`libs/${libName}/.old_storybook/addons.js`)
    ).toBeTruthy();
    expect(tree.exists(`libs/${libName}/.storybook/main.js`)).toBeTruthy();
  });
});
