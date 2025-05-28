import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree } from '@nx/devkit';
import { writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { componentGenerator } from '../component/component';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { scamGenerator } from '../scam/scam';
import {
  createStorybookTestWorkspaceForLib,
  generateTestLibrary,
} from '../utils/testing';
import { angularStoriesGenerator } from './stories';

describe('angularStories generator: libraries', () => {
  const libName = 'test-ui-lib';

  describe('Stories for empty Angular library', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await generateTestLibrary(tree, { directory: libName, skipFormat: true });
    });

    it('should not fail on empty NgModule declarations', () => {
      expect(
        async () =>
          await angularStoriesGenerator(tree, {
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
      writeJson(tree, `${libName}/package.json`, { name: libName });
      await librarySecondaryEntryPointGenerator(tree, {
        library: libName,
        name: 'secondary-entry-point',
        skipFormat: true,
      });
      // add a standalone component to the secondary entrypoint
      await componentGenerator(tree, {
        name: 'secondary-button',
        path: `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button`,
        skipFormat: true,
      });

      await angularStoriesGenerator(tree, { name: libName });

      expect(
        tree.exists(
          `${libName}/src/lib/barrel/barrel-button/barrel-button.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `${libName}/src/lib/nested/nested-button/nested-button.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(`${libName}/src/lib/test-button/test-button.stories.ts`)
      ).toBeTruthy();
      expect(
        tree.exists(`${libName}/src/lib/test-other/test-other.stories.ts`)
      ).toBeTruthy();
      expect(
        tree.read(
          `${libName}/src/lib/test-button/test-button.stories.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.exists(
          `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button.stories.ts`
        )
      ).toBeTruthy();
    });

    it('should generate stories.ts files for components generated with a type "component"', async () => {
      writeJson(tree, `${libName}/package.json`, { name: libName });
      await librarySecondaryEntryPointGenerator(tree, {
        library: libName,
        name: 'secondary-entry-point',
        skipFormat: true,
      });
      await componentGenerator(tree, {
        name: 'secondary-button',
        path: `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button`,
        type: 'component',
        skipFormat: true,
      });

      await angularStoriesGenerator(tree, { name: libName });

      expect(
        tree.exists(
          `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button.component.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.read(
          `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button.component.stories.ts`,
          'utf-8'
        )
      ).toMatchInlineSnapshot(`
        "import type { Meta, StoryObj } from '@storybook/angular';
        import { SecondaryButtonComponent } from './secondary-button.component';
        import { within } from '@storybook/testing-library';
        import { expect } from '@storybook/jest';

        const meta: Meta<SecondaryButtonComponent> = {
          component: SecondaryButtonComponent,
          title: 'SecondaryButtonComponent',
        };
        export default meta;
        type Story = StoryObj<SecondaryButtonComponent>;

        export const Primary: Story = {
          args: {},
        };

        export const Heading: Story = {
          args: {},
          play: async ({ canvasElement }) => {
            const canvas = within(canvasElement);
            expect(canvas.getByText(/secondary-button works!/gi)).toBeTruthy();
          },
        };
        "
      `);
    });

    it('should run twice without errors', async () => {
      try {
        await angularStoriesGenerator(tree, {
          name: libName,
          skipFormat: true,
        });
        await angularStoriesGenerator(tree, {
          name: libName,
          skipFormat: true,
        });
      } catch {
        fail('Should not fail when running it twice.');
      }
    });

    it('should handle modules with variable declarations rather than literals', async () => {
      await angularStoriesGenerator(tree, {
        name: libName,
        skipFormat: true,
      });

      expect(
        tree.exists(
          `${libName}/src/lib/variable-declare/variable-declare-button/variable-declare-button.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `${libName}/src/lib/variable-declare/variable-declare-view/variable-declare-view.stories.ts`
        )
      ).toBeTruthy();
    });

    it('should handle modules where components are spread into the declarations array', async () => {
      await angularStoriesGenerator(tree, {
        name: libName,
        skipFormat: true,
      });

      expect(
        tree.exists(
          `${libName}/src/lib/variable-spread-declare/variable-spread-declare-anotherview/variable-spread-declare-anotherview.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `${libName}/src/lib/variable-spread-declare/variable-spread-declare-button/variable-spread-declare-button.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `${libName}/src/lib/variable-spread-declare/variable-spread-declare-view/variable-spread-declare-view.stories.ts`
        )
      ).toBeTruthy();
    });

    it('should handle modules using static members for declarations rather than literals', async () => {
      await angularStoriesGenerator(tree, {
        name: libName,
        skipFormat: true,
      });

      expect(
        tree.exists(
          `${libName}/src/lib/static-member-declarations/cmp1/cmp1.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          `${libName}/src/lib/static-member-declarations/cmp2/cmp2.stories.ts`
        )
      ).toBeTruthy();
    });

    it('should generate stories file for scam component', async () => {
      await scamGenerator(tree, {
        name: 'my-scam',
        path: `${libName}/src/lib/my-scam/my-scam`,
        skipFormat: true,
      });

      await angularStoriesGenerator(tree, { name: libName, skipFormat: true });

      expect(
        tree.exists(`${libName}/src/lib/my-scam/my-scam.stories.ts`)
      ).toBeTruthy();
    });

    it('should generate stories file for inline scam component', async () => {
      await scamGenerator(tree, {
        name: 'my-scam',
        path: `${libName}/src/lib/my-scam/my-scam`,
        inlineScam: true,
        skipFormat: true,
      });

      await angularStoriesGenerator(tree, { name: libName, skipFormat: true });

      expect(
        tree.exists(`${libName}/src/lib/my-scam/my-scam.stories.ts`)
      ).toBeTruthy();
    });

    it('should generate stories file for standalone components', async () => {
      // add standalone component
      await componentGenerator(tree, {
        name: 'standalone',
        path: `${libName}/src/lib/standalone/standalone`,
        standalone: true,
        skipFormat: true,
      });
      // add secondary entrypoint
      writeJson(tree, `${libName}/package.json`, { name: libName });
      await librarySecondaryEntryPointGenerator(tree, {
        library: libName,
        name: 'secondary-entry-point',
        skipFormat: true,
      });
      // add a standalone component to the secondary entrypoint
      await componentGenerator(tree, {
        name: 'secondary-standalone',
        path: `${libName}/secondary-entry-point/src/lib/secondary-standalone/secondary-standalone`,
        standalone: true,
        skipFormat: true,
      });

      await angularStoriesGenerator(tree, { name: libName });

      expect(
        tree.exists(`${libName}/src/lib/standalone/standalone.stories.ts`)
      ).toBeTruthy();
      expect(
        tree.read(
          `${libName}/src/lib/standalone/standalone.stories.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.exists(
          `${libName}/secondary-entry-point/src/lib/secondary-standalone/secondary-standalone.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.read(
          `${libName}/secondary-entry-point/src/lib/secondary-standalone/secondary-standalone.stories.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
    });

    it('should ignore paths', async () => {
      // add secondary entrypoint
      writeJson(tree, `${libName}/package.json`, { name: libName });
      await librarySecondaryEntryPointGenerator(tree, {
        library: libName,
        name: 'secondary-entry-point',
        skipFormat: true,
      });
      // add a standalone component to the secondary entrypoint
      await componentGenerator(tree, {
        name: 'secondary-button',
        path: `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button`,
        skipFormat: true,
      });

      await angularStoriesGenerator(tree, {
        name: libName,
        ignorePaths: [
          `${libName}/src/lib/barrel/**`,
          `${libName}/secondary-entry-point/**`,
        ],
        skipFormat: true,
      });

      expect(
        tree.exists(
          `${libName}/src/lib/barrel/barrel-button/barrel-button.stories.ts`
        )
      ).toBeFalsy();
      expect(
        tree.exists(
          `${libName}/src/lib/nested/nested-button/nested-button.stories.ts`
        )
      ).toBeTruthy();
      expect(
        tree.exists(`${libName}/src/lib/test-button/test-button.stories.ts`)
      ).toBeTruthy();
      expect(
        tree.exists(`${libName}/src/lib/test-other/test-other.stories.ts`)
      ).toBeTruthy();
      expect(
        tree.read(
          `${libName}/src/lib/test-button/test-button.stories.ts`,
          'utf-8'
        )
      ).toMatchSnapshot();
      expect(
        tree.exists(
          `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button.stories.ts`
        )
      ).toBeFalsy();
    });
  });
});
