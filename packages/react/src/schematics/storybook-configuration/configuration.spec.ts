import { externalSchematic, Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../utils/testing';
import { StorybookConfigureSchema } from './schema';

describe('react:storybook-configuration', () => {
  let appTree;

  // beforeEach(async () => {
  //   appTree = await createTestUILib('test-ui-lib');
  // });

  it('should configure everything at once', async () => {
    appTree = await createTestUILib('test-ui-lib');

    const tree = await runSchematic(
      'storybook-configuration',
      <StorybookConfigureSchema>{
        name: 'test-ui-lib',
        configureCypress: true
      },
      appTree
    );
    expect(tree.exists('libs/test-ui-lib/.storybook/addons.js')).toBeTruthy();
    expect(tree.exists('libs/test-ui-lib/.storybook/config.js')).toBeTruthy();
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeTruthy();
  });

  it('should generate stories for components', async () => {
    appTree = await createTestUILib('test-ui-lib');

    const tree = await runSchematic(
      'storybook-configuration',
      <StorybookConfigureSchema>{
        name: 'test-ui-lib',
        generateStories: true
      },
      appTree
    );

    expect(
      tree.exists('libs/test-ui-lib/src/lib/test-ui-lib.stories.tsx')
    ).toBeTruthy();
  });

  it('should generate stories for components written in plain JS', async () => {
    appTree = await createTestUILib('test-ui-lib', true);

    appTree.create(
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

    const tree = await runSchematic(
      'storybook-configuration',
      <StorybookConfigureSchema>{
        name: 'test-ui-lib',
        generateCypressSpecs: true,
        generateStories: true,
        js: true
      },
      appTree
    );

    expect(
      tree.exists('libs/test-ui-lib/src/lib/test-ui-libplain.stories.js')
    ).toBeTruthy();
  });
});

export async function createTestUILib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/react', 'library', {
      name: libName,
      js: plainJS
    }),
    appTree
  );
  return appTree;
}
