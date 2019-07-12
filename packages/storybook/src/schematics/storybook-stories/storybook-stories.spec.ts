import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic, createTestUILib } from '../../utils/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';
import {
  babelCoreVersion,
  storybookAddonKnobsVersion,
  storybookAngularVersion,
  babelLoaderVersion
} from '../../utils/versions';
import { StorybookStoriesSchema } from './storybook-stories';
import { CypressConfigureSchema } from '../cypress-configure/cypress-configure';

describe('schematic:storybook-stories', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib();
  });

  describe('Storybook stories', () => {
    it('should generate stories.ts files', async () => {
      const tree = await runSchematic<StorybookStoriesSchema>(
        'storybook-stories',
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
      let tree = await runSchematic<CypressConfigureSchema>(
        'cypress-configure',
        { name: 'test-ui-lib' },
        appTree
      );
      tree = await runSchematic<StorybookStoriesSchema>(
        'storybook-stories',
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
      let tree = await runSchematic<CypressConfigureSchema>(
        'cypress-configure',
        { name: 'test-ui-lib' },
        appTree
      );
      tree = await runSchematic<StorybookStoriesSchema>(
        'storybook-stories',
        { name: 'test-ui-lib', generateCypressSpecs: false },
        tree
      );
      tree = await runSchematic<StorybookStoriesSchema>(
        'storybook-stories',
        { name: 'test-ui-lib', generateCypressSpecs: true },
        tree
      );
    });
  });
});
