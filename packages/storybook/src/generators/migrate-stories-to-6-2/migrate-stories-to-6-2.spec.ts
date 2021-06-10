import { Tree } from '@angular-devkit/schematics';
import { SyntaxKind } from 'typescript';
import ts = require('typescript');
import { nxVersion, storybookVersion } from '../../utils/versions';
import { runExternalSchematic, runSchematic } from '../../utils/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { serializeJson } from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utils/ast-utils';

describe('migrate-stories-to-6-2 schematic', () => {
  let appTree: Tree;

  describe('angular project', () => {
    beforeEach(async () => {
      appTree = Tree.empty();
      appTree = createEmptyWorkspace(appTree);
      appTree = await runExternalSchematic(
        '@nrwl/angular',
        'lib',
        {
          name: 'test-ui-lib',
        },
        appTree
      );

      appTree = await runExternalSchematic(
        '@schematics/angular',
        'component',
        {
          name: 'test-button',
          project: 'test-ui-lib',
        },
        appTree
      );

      appTree = await runExternalSchematic(
        '@nrwl/angular',
        'storybook-configuration',
        {
          name: 'test-ui-lib',
        },
        appTree
      );

      appTree.overwrite(
        'package.json',
        serializeJson({
          devDependencies: {
            '@nrwl/storybook': nxVersion,
            '@storybook/addon-knobs': storybookVersion,
            '@storybook/angular': storybookVersion,
          },
        })
      );

      appTree.overwrite(
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
      appTree = await runSchematic(
        'migrate-stories-to-6-2',
        {
          name: 'test-ui-lib',
        },
        appTree
      );
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

function getTsSourceFile(host: Tree, path: string): ts.SourceFile {
  const buffer = host.read(path);
  if (!buffer) {
    throw new Error(`Could not read TS file (${path}).`);
  }
  const content = buffer.toString();
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  return source;
}
