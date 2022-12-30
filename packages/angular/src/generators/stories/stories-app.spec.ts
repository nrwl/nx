import { installedCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import type { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { applicationGenerator } from '../application/application';
import { scamGenerator } from '../scam/scam';
import { componentGenerator } from '../component/component';
import { angularStoriesGenerator } from './stories';

// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nrwl/cypress/src/utils/cypress-version');
describe('angularStories generator: applications', () => {
  let tree: Tree;
  const appName = 'test-app';
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree = createTreeWithEmptyV1Workspace();
    await applicationGenerator(tree, {
      name: appName,
    });
  });

  it('should generate stories file', () => {
    angularStoriesGenerator(tree, { name: appName });

    expect(
      tree.exists(`apps/${appName}/src/app/app.component.stories.ts`)
    ).toBeTruthy();
  });

  it('should generate stories file for scam component', async () => {
    await scamGenerator(tree, { name: 'my-scam', project: appName });

    angularStoriesGenerator(tree, { name: appName });

    expect(
      tree.exists(
        `apps/${appName}/src/app/my-scam/my-scam.component.stories.ts`
      )
    ).toBeTruthy();
  });

  it('should ignore paths', async () => {
    await scamGenerator(tree, { name: 'my-scam', project: appName });

    angularStoriesGenerator(tree, {
      name: appName,
      ignorePaths: [`apps/${appName}/src/app/my-scam/**`],
    });

    expect(
      tree.exists(
        `apps/${appName}/src/app/my-scam/my-scam.component.stories.ts`
      )
    ).toBeFalsy();
  });

  it('should ignore paths when full path to component is provided', async () => {
    await scamGenerator(tree, { name: 'my-scam', project: appName });

    angularStoriesGenerator(tree, {
      name: appName,
      ignorePaths: [`apps/${appName}/src/app/my-scam/my-scam.component.ts`],
    });

    expect(
      tree.exists(
        `apps/${appName}/src/app/my-scam/my-scam.component.stories.ts`
      )
    ).toBeFalsy();
  });

  it('should ignore a path that has a nested component, but still generate nested component stories', async () => {
    await componentGenerator(tree, { name: 'component-a', project: appName });
    await componentGenerator(tree, {
      name: 'component-a/component-b',
      project: appName,
    });

    angularStoriesGenerator(tree, {
      name: appName,
      ignorePaths: [
        `apps/${appName}/src/app/component-a/component-a.component.ts`,
      ],
    });

    expect(
      tree.exists(
        `apps/${appName}/src/app/component-a/component-b/component-b.component.stories.ts`
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        `apps/${appName}/src/app/component-a/component-a.component.stories.ts`
      )
    ).toBeFalsy();
  });

  it('should generate stories file for inline scam component', async () => {
    await scamGenerator(tree, {
      name: 'my-scam',
      project: appName,
      inlineScam: true,
    });

    angularStoriesGenerator(tree, { name: appName });

    expect(
      tree.exists(
        `apps/${appName}/src/app/my-scam/my-scam.component.stories.ts`
      )
    ).toBeTruthy();
  });

  it('should generate cypress spec file', () => {
    angularStoriesGenerator(tree, {
      name: appName,
      generateCypressSpecs: true,
    });

    expect(
      tree.exists(`apps/${appName}-e2e/src/e2e/app.component.cy.ts`)
    ).toBeTruthy();
  });
});
