import type { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { cypressProjectGenerator } from '@nrwl/storybook';
import { libraryGenerator } from '../library/library';
import { scamGenerator } from '../scam/scam';
import { createStorybookTestWorkspaceForLib } from '../utils/testing';
import { angularStoriesGenerator } from './stories';

describe('angularStories generator: libraries', () => {
  const libName = 'test-ui-lib';

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

    it('should generate stories.ts files', () => {
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
          `apps/${libName}-e2e/src/integration/barrel-button/barrel-button.component.spec.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/integration/nested-button/nested-button.component.spec.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/integration/test-button/test-button.component.spec.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/integration/test-other/test-other.component.spec.ts`
        )
      ).toBeTruthy();
      expect(
        tree.read(
          `apps/${libName}-e2e/src/integration/test-button/test-button.component.spec.ts`,
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
          `apps/${libName}-e2e/src/integration/variable-declare-button/variable-declare-button.component.spec.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/integration/variable-declare-view/variable-declare-view.component.spec.ts`
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
          `apps/${libName}-e2e/src/integration/variable-spread-declare-button/variable-spread-declare-button.component.spec.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/integration/variable-spread-declare-view/variable-spread-declare-view.component.spec.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/integration/variable-spread-declare-anotherview/variable-spread-declare-anotherview.component.spec.ts`
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
        tree.exists(
          `apps/${libName}-e2e/src/integration/cmp1/cmp1.component.spec.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `apps/${libName}-e2e/src/integration/cmp2/cmp2.component.spec.ts`
        )
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
  });
});
