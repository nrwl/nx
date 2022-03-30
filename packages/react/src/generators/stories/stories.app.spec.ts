import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import applicationGenerator from '../application/application';
import storiesGenerator from './stories';

describe('react:stories for applications', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUIApp('test-ui-app');

    // create another component
    appTree.write(
      'apps/test-ui-app/src/app/anothercmp/another-cmp.tsx',
      `import React from 'react';

      import './test.scss';

      export interface TestProps {
        name: string;
        displayAge: boolean;
      }

      export const Test = (props: TestProps) => {
        return (
          <div>
            <h1>Welcome to test component, {props.name}</h1>
          </div>
        );
      };

      export default Test;
      `
    );
  });

  it('should create the stories', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      generateCypressSpecs: false,
    });

    expect(
      appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
    ).toBeTruthy();
    expect(
      appTree.exists(
        'apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx'
      )
    ).toBeTruthy();
  });

  it('should generate Cypress specs', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      generateCypressSpecs: true,
    });

    expect(
      appTree.exists('apps/test-ui-app-e2e/src/e2e/app.cy.ts')
    ).toBeTruthy();
    expect(
      appTree.exists(
        'apps/test-ui-app-e2e/src/e2e/another-cmp/another-cmp.cy.ts'
      )
    ).toBeTruthy();
  });

  it('should ignore files that do not contain components', async () => {
    // create another component
    appTree.write(
      'apps/test-ui-app/src/app/some-utils.js',
      `export const add = (a: number, b: number) => a + b;`
    );

    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      generateCypressSpecs: false,
    });

    // should just create the story and not error, even though there's a js file
    // not containing any react component
    expect(
      appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
    ).toBeTruthy();
  });

  it('should not update existing stories', async () => {
    // ARRANGE
    appTree.write(
      'apps/test-ui-app/src/app/nx-welcome.stories.tsx',
      `import { ComponentStory, ComponentMeta } from '@storybook/react'`
    );

    // ACT
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      generateCypressSpecs: false,
    });

    // ASSERT
    expect(
      appTree.read('apps/test-ui-app/src/app/nx-welcome.stories.tsx', 'utf-8')
    ).toEqual(
      `import { ComponentStory, ComponentMeta } from '@storybook/react'`
    );
  });
});

export async function createTestUIApp(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await applicationGenerator(appTree, {
    e2eTestRunner: 'cypress',
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    js: plainJS,
    standaloneConfig: false,
  });
  return appTree;
}
