import { externalSchematic, Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../utils/testing';
import { StorybookConfigureSchema } from './schema';

describe('react:storybook-configuration', () => {
  let appTree;

  // beforeEach(async () => {
  //   appTree = await createTestUILib('test-ui-lib');
  // });

  describe('libraries', () => {
    it('should configure everything at once', async () => {
      appTree = await createTestUILib('test-ui-lib');

      const tree = await runSchematic(
        'storybook-configuration',
        <StorybookConfigureSchema>{
          name: 'test-ui-lib',
          configureCypress: true,
          generateCypressSpecs: true,
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
          generateStories: true,
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
          js: true,
        },
        appTree
      );

      expect(
        tree.exists('libs/test-ui-lib/src/lib/test-ui-libplain.stories.js')
      ).toBeTruthy();
    });
  });

  describe('applications', () => {
    it('should configure everything at once', async () => {
      appTree = await createTestAppLib('test-ui-app');

      const tree = await runSchematic(
        'storybook-configuration',
        <StorybookConfigureSchema>{
          name: 'test-ui-app',
          configureCypress: true,
        },
        appTree
      );

      expect(tree.exists('apps/test-ui-app/.storybook/addons.js')).toBeTruthy();
      expect(tree.exists('apps/test-ui-app/.storybook/config.js')).toBeTruthy();
      expect(
        tree.exists('apps/test-ui-app/.storybook/tsconfig.json')
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

      const tree = await runSchematic(
        'storybook-configuration',
        <StorybookConfigureSchema>{
          name: 'test-ui-app',
          generateStories: true,
        },
        appTree
      );

      // Currently the auto-generate stories feature only picks up components under the 'lib' directory.
      // In our 'createTestAppLib' function, we call @nrwl/react:component to generate a component
      // under the specified 'lib' directory
      expect(
        tree.exists(
          'apps/test-ui-app/src/app/my-component/my-component.stories.tsx'
        )
      ).toBeTruthy();
    });
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
      js: plainJS,
    }),
    appTree
  );
  return appTree;
}

export async function createTestAppLib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/react', 'application', {
      name: libName,
      js: plainJS,
      e2eTestRunner: 'none',
    }),
    appTree
  );
  appTree = await callRule(
    externalSchematic('@nrwl/react', 'component', {
      name: 'my-component',
      project: libName,
      directory: 'app',
    }),
    appTree
  );
  return appTree;
}
