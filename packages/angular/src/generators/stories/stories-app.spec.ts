import type { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { applicationGenerator } from '../application/application';
import { scamGenerator } from '../scam/scam';
import { angularStoriesGenerator } from './stories';

describe('angularStories generator: applications', () => {
  let tree: Tree;
  const appName = 'test-app';

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
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
