import * as fileUtils from '@nrwl/workspace/src/core/file-utils';
import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import libraryGenerator from '../library/library';
import { Linter } from '@nrwl/linter';
import { logger } from '@nrwl/devkit';
import applicationGenerator from '../application/application';
import componentGenerator from '../component/component';
import storybookConfigurationGenerator from './configuration';

describe('react:storybook-configuration', () => {
  let appTree;

  beforeEach(async () => {
    jest.spyOn(fileUtils, 'readPackageJson').mockReturnValue({
      devDependencies: {
        '@storybook/addon-essentials': '^6.0.21',
        '@storybook/react': '^6.0.21',
      },
    });

    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should configure everything at once', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-lib',
      configureCypress: true,
      standaloneConfig: false,
    });

    expect(appTree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
    expect(
      appTree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
    expect(appTree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeTruthy();
  });

  it('should generate stories for components', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-lib',
      generateStories: true,
      configureCypress: false,
      standaloneConfig: false,
    });

    expect(
      appTree.exists('libs/test-ui-lib/src/lib/test-ui-lib.stories.tsx')
    ).toBeTruthy();
  });

  it('should generate stories for components written in plain JS', async () => {
    appTree = await createTestUILib('test-ui-lib', true);

    appTree.write(
      'libs/test-ui-lib/src/lib/test-ui-libplain.js',
      `import React from 'react';

      import './test.scss';

      export const Test = (props) => {
        return (
          <div>
            <h1>Welcome to test component</h1>
          </div>
        );
      };

      export default Test;
      `
    );
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-lib',
      generateCypressSpecs: true,
      generateStories: true,
      configureCypress: false,
      js: true,
      standaloneConfig: false,
    });

    expect(
      appTree.exists('libs/test-ui-lib/src/lib/test-ui-libplain.stories.js')
    ).toBeTruthy();
  });

  it('should configure everything at once', async () => {
    appTree = await createTestAppLib('test-ui-app');
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-app',
      configureCypress: true,
      standaloneConfig: false,
    });

    expect(appTree.exists('apps/test-ui-app/.storybook/main.js')).toBeTruthy();
    expect(
      appTree.exists('apps/test-ui-app/.storybook/tsconfig.json')
    ).toBeTruthy();

    /**
     * Note on the removal of
     * expect(tree.exists('apps/test-ui-app-e2e/cypress.json')).toBeTruthy();
     *
     * When calling createTestAppLib() we do not generate an e2e suite.
     * The storybook schematic for apps does not generate e2e test.
     * So, there exists no test-ui-app-e2e!
     */
  });

  it('should generate stories for components', async () => {
    appTree = await createTestAppLib('test-ui-app');
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-app',
      generateStories: true,
      configureCypress: false,
      standaloneConfig: false,
    });

    // Currently the auto-generate stories feature only picks up components under the 'lib' directory.
    // In our 'createTestAppLib' function, we call @nrwl/react:component to generate a component
    // under the specified 'lib' directory
    expect(
      appTree.exists(
        'apps/test-ui-app/src/app/my-component/my-component.stories.tsx'
      )
    ).toBeTruthy();
  });

  it('should generate cypress tests in the correct folder', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await componentGenerator(appTree, {
      name: 'my-component',
      project: 'test-ui-lib',
      style: 'css',
    });
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-lib',
      generateStories: true,
      configureCypress: true,
      generateCypressSpecs: true,
      cypressDirectory: 'one/two',
      standaloneConfig: false,
    });
    [
      'apps/one/two/test-ui-lib-e2e/cypress.json',
      'apps/one/two/test-ui-lib-e2e/src/fixtures/example.json',
      'apps/one/two/test-ui-lib-e2e/src/support/commands.ts',
      'apps/one/two/test-ui-lib-e2e/src/support/index.ts',
      'apps/one/two/test-ui-lib-e2e/tsconfig.json',
      'apps/one/two/test-ui-lib-e2e/.eslintrc.json',
      'apps/one/two/test-ui-lib-e2e/src/integration/test-ui-lib/test-ui-lib.spec.ts',
      'apps/one/two/test-ui-lib-e2e/src/integration/my-component/my-component.spec.ts',
    ].forEach((file) => {
      expect(appTree.exists(file)).toBeTruthy();
    });
  });
});

export async function createTestUILib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await libraryGenerator(appTree, {
    linter: Linter.EsLint,
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    standaloneConfig: false,
  });
  return appTree;
}

export async function createTestAppLib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await applicationGenerator(appTree, {
    babelJest: false,
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    js: plainJS,
    standaloneConfig: false,
  });

  await componentGenerator(appTree, {
    name: 'my-component',
    project: libName,
    directory: 'app',
    style: 'css',
  });

  return appTree;
}
