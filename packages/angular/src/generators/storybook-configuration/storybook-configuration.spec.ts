import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import type { Tree } from '@nx/devkit';
import { writeJson } from '@nx/devkit';
import { Linter } from 'packages/linter/src/generators/utils/linter';
import { componentGenerator } from '../component/component';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { createStorybookTestWorkspaceForLib } from '../utils/testing';
import type { StorybookConfigurationOptions } from './schema';
import { storybookConfigurationGenerator } from './storybook-configuration';

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
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree = await createStorybookTestWorkspaceForLib(libName);

    jest.resetModules();
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
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.config.ts')).toBeFalsy();
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
      tree.read('libs/test-ui-lib/.storybook/main.js', 'utf-8')
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
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.config.ts')).toBeTruthy();
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
        'apps/test-ui-lib-e2e/src/e2e/test-button/test-button.component.cy.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/e2e/test-other/test-other.component.cy.ts'
      )
    ).toBeTruthy();
  });

  it('should generate the right files', async () => {
    // add standalone component
    await componentGenerator(tree, {
      name: 'standalone',
      project: libName,
      standalone: true,
    });
    // add secondary entrypoint
    writeJson(tree, `libs/${libName}/package.json`, { name: libName });
    await librarySecondaryEntryPointGenerator(tree, {
      library: libName,
      name: 'secondary-entry-point',
    });
    // add a regular component to the secondary entrypoint
    await componentGenerator(tree, {
      name: 'secondary-button',
      project: libName,
      path: `libs/${libName}/secondary-entry-point/src/lib`,
      export: true,
    });
    // add a standalone component to the secondary entrypoint
    await componentGenerator(tree, {
      name: 'secondary-standalone',
      project: libName,
      path: `libs/${libName}/secondary-entry-point/src/lib`,
      standalone: true,
      export: true,
    });

    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      name: libName,
      configureCypress: true,
      generateCypressSpecs: true,
      generateStories: true,
    });

    expect(listFiles(tree)).toMatchSnapshot();
  });

  it('should generate in the correct folder', async () => {
    // add standalone component
    await componentGenerator(tree, {
      name: 'standalone',
      project: libName,
      standalone: true,
    });
    // add secondary entrypoint
    writeJson(tree, `libs/${libName}/package.json`, { name: libName });
    await librarySecondaryEntryPointGenerator(tree, {
      library: libName,
      name: 'secondary-entry-point',
    });
    // add a regular component to the secondary entrypoint
    await componentGenerator(tree, {
      name: 'secondary-button',
      project: libName,
      path: `libs/${libName}/secondary-entry-point/src/lib`,
      export: true,
    });
    // add a standalone component to the secondary entrypoint
    await componentGenerator(tree, {
      name: 'secondary-standalone',
      project: libName,
      path: `libs/${libName}/secondary-entry-point/src/lib`,
      standalone: true,
      export: true,
    });

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
