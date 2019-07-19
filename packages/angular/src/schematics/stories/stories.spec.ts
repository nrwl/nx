import { Tree } from '@angular-devkit/schematics';
import { CypressConfigureSchema } from '../../../../storybook/src/schematics/cypress-project/cypress-project';
import { StorybookStoriesSchema } from './stories';
import {
  createTestUILib,
  runSchematic,
  runExternalSchematic
} from '../../utils/testing';

describe('schematic:stories', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib();
  });

  describe('Storybook stories', () => {
    it('should generate stories.ts files', async () => {
      const tree = await runSchematic<StorybookStoriesSchema>(
        'stories',
        { name: 'test-ui-lib', generateCypressSpecs: false },
        appTree
      );

      expect(
        tree.exists(
          'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          'libs/test-ui-lib/src/lib/test-other/test-other.component.stories.ts'
        )
      ).toBeTruthy();
      const propLines = [
        `buttonType: text('buttonType', 'button'),`,
        `style: text('style', 'default'),`,
        `age: number('age', ''),`,
        `isOn: boolean('isOn', false),    `
      ];
      const storyContent = tree.readContent(
        'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
      );
      propLines.forEach(propLine => {
        storyContent.includes(propLine);
      });
    });

    it('should generate cypress spec files', async () => {
      let tree = await runExternalSchematic(
        '@nrwl/storybook',
        'cypress-project',
        { name: 'test-ui-lib' },
        appTree
      );
      tree = await runSchematic<StorybookStoriesSchema>(
        'stories',
        { name: 'test-ui-lib', generateCypressSpecs: true },
        tree
      );

      expect(
        tree.exists(
          'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          'libs/test-ui-lib/src/lib/test-other/test-other.component.stories.ts'
        )
      ).toBeTruthy();
      const propLines = [
        `buttonType: text('buttonType', 'button'),`,
        `style: text('style', 'default'),`,
        `age: number('age', ''),`,
        `isOn: boolean('isOn', false),    `
      ];
      const storyContent = tree.readContent(
        'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
      );
      propLines.forEach(propLine => {
        storyContent.includes(propLine);
      });

      expect(
        tree.exists(
          'apps/test-ui-lib-e2e/src/integration/test-button/test-button.component.spec.ts'
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          'apps/test-ui-lib-e2e/src/integration/test-other/test-other.component.spec.ts'
        )
      ).toBeTruthy();
    });

    it('should run twice without errors', async () => {
      let tree = await runExternalSchematic(
        '@nrwl/storybook',
        'cypress-project',
        { name: 'test-ui-lib' },
        appTree
      );
      tree = await runSchematic<StorybookStoriesSchema>(
        'stories',
        { name: 'test-ui-lib', generateCypressSpecs: false },
        tree
      );
      tree = await runSchematic<StorybookStoriesSchema>(
        'stories',
        { name: 'test-ui-lib', generateCypressSpecs: true },
        tree
      );
    });
  });
});
