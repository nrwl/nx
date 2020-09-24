import { Tree, externalSchematic } from '@angular-devkit/schematics';
import { runSchematic, callRule } from '../../utils/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { StorybookStoriesSchema } from './stories';
import { Schema } from 'packages/react/src/schematics/application/schema';

describe('react:stories for applications', () => {
  let appTree: Tree;
  let tree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createTestUIApp('test-ui-app');

    // create another component
    appTree.create(
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
    tree = await runSchematic(
      'stories',
      <StorybookStoriesSchema>{
        project: 'test-ui-app',
      },
      appTree
    );

    expect(
      tree.exists('apps/test-ui-app/src/app/app.stories.tsx')
    ).toBeTruthy();
    expect(
      tree.exists('apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx')
    ).toBeTruthy();
  });

  it('should generate Cypress specs', async () => {
    tree = await runSchematic(
      'stories',
      <StorybookStoriesSchema>{
        project: 'test-ui-app',
        generateCypressSpecs: true,
      },
      appTree
    );

    expect(
      tree.exists('apps/test-ui-app-e2e/src/integration/app.spec.ts')
    ).toBeTruthy();
    expect(
      tree.exists(
        'apps/test-ui-app-e2e/src/integration/another-cmp/another-cmp.spec.ts'
      )
    ).toBeTruthy();
  });

  xit('should not overwrite existing stories', () => {});

  it('should ignore files that do not contain components', async () => {
    // create another component
    appTree.create(
      'apps/test-ui-app/src/app/some-utils.js',
      `export const add = (a: number, b: number) => a + b;`
    );

    tree = await runSchematic(
      'stories',
      <StorybookStoriesSchema>{
        project: 'test-ui-app',
      },
      appTree
    );

    // should just create the story and not error, even though there's a js file
    // not containing any react component
    expect(
      tree.exists('apps/test-ui-app/src/app/app.stories.tsx')
    ).toBeTruthy();
  });
});

export async function createTestUIApp(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/react', 'application', {
      name: libName,
      js: plainJS,
    }),
    appTree
  );
  return appTree;
}
