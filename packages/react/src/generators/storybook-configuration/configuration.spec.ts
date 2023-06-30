import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import applicationGenerator from '../application/application';
import componentGenerator from '../component/component';
import libraryGenerator from '../library/library';
import storybookConfigurationGenerator from './configuration';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

describe('react:storybook-configuration', () => {
  let appTree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should configure everything at once', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-lib',
      configureCypress: true,
    });

    expect(appTree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
    expect(
      appTree.exists('libs/test-ui-lib/tsconfig.storybook.json')
    ).toBeTruthy();
    expect(
      appTree.exists('apps/test-ui-lib-e2e/cypress.config.ts')
    ).toBeTruthy();
  });

  it('should generate stories for components', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-lib',
      generateStories: true,
      configureCypress: false,
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
    });

    expect(appTree.exists('apps/test-ui-app/.storybook/main.js')).toBeTruthy();
    expect(
      appTree.exists('apps/test-ui-app/tsconfig.storybook.json')
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
    });

    // Currently the auto-generate stories feature only picks up components under the 'lib' directory.
    // In our 'createTestAppLib' function, we call @nx/react:component to generate a component
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
    });
    [
      'apps/one/two/test-ui-lib-e2e/cypress.config.ts',
      'apps/one/two/test-ui-lib-e2e/src/fixtures/example.json',
      'apps/one/two/test-ui-lib-e2e/src/support/commands.ts',
      'apps/one/two/test-ui-lib-e2e/src/support/e2e.ts',
      'apps/one/two/test-ui-lib-e2e/tsconfig.json',
      'apps/one/two/test-ui-lib-e2e/.eslintrc.json',
      'apps/one/two/test-ui-lib-e2e/src/e2e/test-ui-lib/test-ui-lib.cy.ts',
      'apps/one/two/test-ui-lib-e2e/src/e2e/my-component/my-component.cy.ts',
    ].forEach((file) => {
      expect(appTree.exists(file)).toBeTruthy();
    });
  });
});

export async function createTestUILib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

  await libraryGenerator(appTree, {
    linter: Linter.EsLint,
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
  });
  return appTree;
}

export async function createTestAppLib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

  await applicationGenerator(appTree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    js: plainJS,
  });

  await componentGenerator(appTree, {
    name: 'my-component',
    project: libName,
    directory: 'app',
    style: 'css',
  });

  return appTree;
}
