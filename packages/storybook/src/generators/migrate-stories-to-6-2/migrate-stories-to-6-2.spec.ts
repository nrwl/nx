import { Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { wrapAngularDevkitSchematic } from '@nrwl/tao/src/commands/ngcli-adapter';
import { SyntaxKind } from 'typescript';
import ts = require('typescript');
import { nxVersion, storybookVersion } from '../../utils/versions';
import migrateStoriesTo62Generator, {
  getTsSourceFile,
} from './migrate-stories-to-6-2';
import { findNodes } from '@nrwl/workspace/src/utils/ast-utils';

const libSchematic = wrapAngularDevkitSchematic('@nrwl/angular', 'lib');
const storybookConfigSchematic = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'storybook-configuration'
);
const componentSchematic = wrapAngularDevkitSchematic(
  '@schematics/angular',
  'component'
);

describe('migrate-stories-to-6-2 schematic', () => {
  let appTree: Tree;

  describe('angular project', () => {
    beforeEach(async () => {
      appTree = createTreeWithEmptyWorkspace();

      await libSchematic(appTree, {
        name: 'test-ui-lib',
      });

      await componentSchematic(appTree, {
        name: 'test-button',
        project: 'test-ui-lib',
      });

      writeJson(appTree, 'package.json', {
        devDependencies: {
          '@nrwl/storybook': nxVersion,
          '@storybook/addon-knobs': storybookVersion,
          '@storybook/angular': storybookVersion,
        },
      });

      await storybookConfigSchematic(appTree, {
        name: 'test-ui-lib',
      });

      appTree.write(
        `libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts`,
        `
          import { text, number, boolean } from '@storybook/addon-knobs';
          import { TestButtonComponent } from './test-button.component';

          export default {
            title: 'TestButtonComponent',
          };

          export const primary = () => ({
            component: TestButtonComponent,
            moduleMetadata: {
              imports: [],
            },
            props: {
              buttonType: text('buttonType', 'button'),
              style: text('style', 'default'),
              age: number('age', 0),
              isOn: boolean('isOn', false),
            },
          });

          export const secondary = () => ({
            component: TestButtonComponent,
            moduleMetadata: {
              imports: [],
            },
            props: {},
          });
      `
      );
    });

    it('should move the component from the story to parameters.component', async () => {
      await migrateStoriesTo62Generator(appTree);
      const storyFilePath =
        'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts';
      const file = getTsSourceFile(appTree, storyFilePath);
      const storiesExportDefault = findNodes(file, [
        ts.SyntaxKind.ExportAssignment,
      ]);
      const defaultExportNode = storiesExportDefault[0];
      const defaultExportObject = defaultExportNode
        ?.getChildren()
        ?.find((node) => {
          return node.kind === SyntaxKind.ObjectLiteralExpression;
        });
      const defaultPropertiesList = defaultExportObject
        ?.getChildren()
        ?.find((node) => {
          return node.kind === SyntaxKind.SyntaxList;
        });

      const hasTitle = defaultPropertiesList?.getChildren()?.find((node) => {
        return (
          node.kind === SyntaxKind.PropertyAssignment &&
          node.getText().startsWith('title')
        );
      });
      const hasComponent = defaultPropertiesList
        ?.getChildren()
        ?.find((node) => {
          return (
            node.kind === SyntaxKind.PropertyAssignment &&
            node.getText().startsWith('component')
          );
        });

      expect(appTree.exists(storyFilePath)).toBeTruthy();
      expect(hasTitle).toBeTruthy();
      expect(hasComponent).toBeTruthy();
    });
  });
});
