import type { Tree } from '@nrwl/devkit';
import { writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { componentGenerator } from '../component/component';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { libraryGenerator } from '../library/library';
import { createStorybookTestWorkspaceForLib } from '../utils/testing';
import { storybookCompodocConfig } from './storybook-compodoc-config';

describe('storybookCompodocConfig generator', () => {
  const libName = 'test-ui-lib';

  describe('Stories for empty Angular library', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyV1Workspace();
      await libraryGenerator(tree, { name: libName });
    });

    it('should not fail on empty NgModule declarations', () => {
      expect(() =>
        storybookCompodocConfig(tree, {
          name: libName,
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

      storybookCompodocConfig(tree, { name: libName });

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
  });
});
