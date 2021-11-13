import type { Tree } from '@nrwl/devkit';
import { joinPathFragments } from '@nrwl/devkit';
import { overrideCollectionResolutionForTesting } from '@nrwl/devkit/ngcli-adapter';
import * as fileUtils from '@nrwl/workspace/src/core/file-utils';
import { Linter } from 'packages/linter/src/generators/utils/linter';
import { createStorybookTestWorkspaceForLib } from '../utils/testing';
import type { StorybookConfigurationOptions } from './schema';
import { storybookConfigurationGenerator } from './storybook-configuration';

function listFiles(tree: Tree): string[] {
  const files = new Set<string>();
  tree.listChanges().forEach((change) => {
    if (change.type !== 'DELETE') {
      files.add(change.path);
    }
  });

  return Array.from(files).sort((a, b) => a.localeCompare(b));
}

describe('StorybookConfiguration generator', () => {
  let tree: Tree;
  const libName = 'test-ui-lib';

  beforeEach(async () => {
    tree = await createStorybookTestWorkspaceForLib(libName);

    overrideCollectionResolutionForTesting({
      '@nrwl/storybook': joinPathFragments(
        __dirname,
        '../../../../storybook/generators.json'
      ),
    });
    jest.resetModules();
    jest.doMock('@storybook/angular/package.json', () => ({
      version: '6.4.0-rc.1',
    }));
    jest.spyOn(fileUtils, 'readPackageJson').mockReturnValue({
      devDependencies: {
        '@storybook/addon-essentials': '~6.2.9',
        '@storybook/react': '~6.2.9',
      },
    });
  });

  it('should throw when the @storybook/angular version is lower than 6.4.0-rc.1', async () => {
    jest.doMock('@storybook/angular/package.json', () => ({
      version: '5.1.0',
    }));

    await expect(
      storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
        name: libName,
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      '"Incompatible Storybook Version: Please use a version of @storybook/angular higher than 6.4.0-rc.1"'
    );
  });

  it('should throw when generateCypressSpecs is true and generateStories is false', async () => {
    await expect(
      storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
        name: libName,
        generateCypressSpecs: true,
        generateStories: false,
      })
    ).rejects.toThrow(
      'Cannot set generateCypressSpecs to true when generateStories is set to false.'
    );
  });

  it('should only configure storybook', async () => {
    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      name: libName,
      configureCypress: false,
      generateCypressSpecs: false,
      generateStories: false,
    });

    expect(tree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeFalsy();
    expect(
      tree.exists(
        'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
      )
    ).toBeFalsy();
    expect(
      tree.exists(
        'libs/test-ui-lib/src/lib/test-other/test-other.component.stories.ts'
      )
    ).toBeFalsy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-button/test-button.component.spec.ts'
      )
    ).toBeFalsy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-other/test-other.component.spec.ts'
      )
    ).toBeFalsy();
  });

  it('should configure storybook to use webpack 5', async () => {
    await storybookConfigurationGenerator(tree, {
      name: libName,
      configureCypress: false,
      generateCypressSpecs: false,
      generateStories: false,
      linter: Linter.None,
    });

    expect(
      tree.read('libs/test-ui-lib/.storybook/main.js').toString()
    ).toMatchSnapshot();
  });

  it('should configure everything at once', async () => {
    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      name: libName,
      configureCypress: true,
      generateCypressSpecs: true,
      generateStories: true,
    });

    expect(tree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeTruthy();
    expect(
      tree.exists(
        'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'libs/test-ui-lib/src/lib/test-other/test-other.component.stories.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-button/test-button.component.spec.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-other/test-other.component.spec.ts'
      )
    ).toBeTruthy();
  });

  it('should generate the right files', async () => {
    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      name: libName,
      configureCypress: true,
      generateCypressSpecs: true,
      generateStories: true,
    });

    expect(listFiles(tree)).toMatchSnapshot();
  });

  it('should generate in the correct folder', async () => {
    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      name: libName,
      configureCypress: true,
      generateCypressSpecs: true,
      generateStories: true,
      cypressDirectory: 'one/two',
    });

    expect(listFiles(tree)).toMatchSnapshot();
  });
});
