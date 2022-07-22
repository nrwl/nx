import { installedCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import type { Tree } from '@nrwl/devkit';
import { writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { cypressProjectGenerator } from '@nrwl/storybook';
import { componentGenerator } from '../component/component';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { libraryGenerator } from '../library/library';
import { scamGenerator } from '../scam/scam';
import { createStorybookTestWorkspaceForLib } from '../utils/testing';
import { angularStoriesGenerator } from './stories';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nrwl/cypress/src/utils/cypress-version');
describe('angularStories generator: libraries', () => {
  const libName = 'test-ui-lib';
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    mockedInstalledCypressVersion.mockReturnValue(10);
  });

  describe('Stories for empty Angular library', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace();
      await libraryGenerator(tree, { name: libName });
    });

    it('should not fail on empty NgModule declarations', () => {
      expect(() =>
        angularStoriesGenerator(tree, {
          name: libName,
          generateCypressSpecs: false,
        })
      ).not.toThrow();
    });
  });

  describe('Stories for non-empty Angular library', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = await createStorybookTestWorkspaceForLib(libName);
    });

    it('should generate stories.ts files', async () => {
      // add secondary entrypoint
      writeJson(tree, `libs/${libName}/package.json`, { name: libName });
      await librarySecondaryEntryPointGenerator(tree, {
        library: libName,
        name: 'secondary-entry-point',
      });
      // add a standalone component to the secondary entrypoint
      await componentGenerator(tree, {
        name: 'secondary-button',
        project: libName,
        path: `libs/${libName}/secondary-entry-point/src/lib`,
      });

      angularStoriesGenerator(tree, { name: libName });

      expect(
        tree.exists(
          `libs/${libName}/src/lib/barrel/barrel-button/barrel-button.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `libs/${libName}/src/lib/nested/nested-button/nested-button.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `libs/${libName}/src/lib/test-button/test-button.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `libs/${libName}/src/lib/test-other/test-other.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.read(
          `libs/${libName}/src/lib/test-button/test-button.component.stories.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.exists(
          `libs/${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button.component.stories.ts`
        )
      ).toBeTruthy();
    });

    it('should generate cypress spec files', async () => {
      await cypressProjectGenerator(tree, {
        linter: Linter.EsLint,
        name: libName,
      });

      angularStoriesGenerator(tree, {
        name: libName,
        generateCypressSpecs: true,
      });

      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/barrel-button/barrel-button.component.cy.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/nested-button/nested-button.component.cy.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/test-button/test-button.component.cy.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/test-other/test-other.component.cy.ts`
        )
      ).toBeTruthy();
      expect(
        tree.read(
          `apps/${libName}-e2e/src/e2e/test-button/test-button.component.cy.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should run twice without errors', async () => {
      await cypressProjectGenerator(tree, {
        linter: Linter.EsLint,
        name: libName,
      });

      try {
        angularStoriesGenerator(tree, { name: libName });
        angularStoriesGenerator(tree, {
          name: libName,
          generateCypressSpecs: true,
        });
      } catch {
        fail('Should not fail when running it twice.');
      }
    });

    it('should handle modules with variable declarations rather than literals', async () => {
      await cypressProjectGenerator(tree, {
        linter: Linter.EsLint,
        name: libName,
      });

      angularStoriesGenerator(tree, {
        name: libName,
        generateCypressSpecs: true,
      });

      expect(
        tree.exists(
          `libs/${libName}/src/lib/variable-declare/variable-declare-button/variable-declare-button.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `libs/${libName}/src/lib/variable-declare/variable-declare-view/variable-declare-view.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/variable-declare-button/variable-declare-button.component.cy.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/variable-declare-view/variable-declare-view.component.cy.ts`
        )
      ).toBeTruthy();
    });

    it('should handle modules with where components are spread into the declarations array', async () => {
      await cypressProjectGenerator(tree, {
        linter: Linter.EsLint,
        name: libName,
      });

      angularStoriesGenerator(tree, {
        name: libName,
        generateCypressSpecs: true,
      });

      expect(
        tree.exists(
          `libs/${libName}/src/lib/variable-spread-declare/variable-spread-declare-anotherview/variable-spread-declare-anotherview.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `libs/${libName}/src/lib/variable-spread-declare/variable-spread-declare-button/variable-spread-declare-button.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `libs/${libName}/src/lib/variable-spread-declare/variable-spread-declare-view/variable-spread-declare-view.component.stories.ts`
        )
      ).toBeTruthy();

      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/variable-spread-declare-button/variable-spread-declare-button.component.cy.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/variable-spread-declare-view/variable-spread-declare-view.component.cy.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/e2e/variable-spread-declare-anotherview/variable-spread-declare-anotherview.component.cy.ts`
        )
      ).toBeTruthy();
    });

    it('should handle modules using static members for declarations rather than literals', async () => {
      await cypressProjectGenerator(tree, {
        linter: Linter.EsLint,
        name: libName,
      });

      angularStoriesGenerator(tree, {
        name: libName,
        generateCypressSpecs: true,
      });

      expect(
        tree.exists(
          `libs/${libName}/src/lib/static-member-declarations/cmp1/cmp1.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `libs/${libName}/src/lib/static-member-declarations/cmp2/cmp2.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(`apps/${libName}-e2e/src/e2e/cmp1/cmp1.component.cy.ts`)
      ).toBeTruthy();
      expect(
        tree.exists(`apps/${libName}-e2e/src/e2e/cmp2/cmp2.component.cy.ts`)
      ).toBeTruthy();
    });

    it('should generate stories file for scam component', async () => {
      await scamGenerator(tree, { name: 'my-scam', project: libName });

      angularStoriesGenerator(tree, { name: libName });

      expect(
        tree.exists(
          `libs/${libName}/src/lib/my-scam/my-scam.component.stories.ts`
        )
      ).toBeTruthy();
    });

    it('should generate stories file for inline scam component', async () => {
      await scamGenerator(tree, {
        name: 'my-scam',
        project: libName,
        inlineScam: true,
      });

      angularStoriesGenerator(tree, { name: libName });

      expect(
        tree.exists(
          `libs/${libName}/src/lib/my-scam/my-scam.component.stories.ts`
        )
      ).toBeTruthy();
    });

    it('should generate stories file for standalone components', async () => {
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
      // add a standalone component to the secondary entrypoint
      await componentGenerator(tree, {
        name: 'secondary-standalone',
        project: libName,
        path: `libs/${libName}/secondary-entry-point/src/lib`,
        standalone: true,
      });

      angularStoriesGenerator(tree, { name: libName });

      expect(
        tree.exists(
          `libs/${libName}/src/lib/standalone/standalone.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.read(
          `libs/${libName}/src/lib/standalone/standalone.component.stories.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.exists(
          `libs/${libName}/secondary-entry-point/src/lib/secondary-standalone/secondary-standalone.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.read(
          `libs/${libName}/secondary-entry-point/src/lib/secondary-standalone/secondary-standalone.component.stories.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
    });
  });
});
