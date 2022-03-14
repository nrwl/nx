import type { Tree } from '@nrwl/devkit';
import { joinPathFragments, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { storybookVersion } from '@nrwl/storybook';
import {
  overrideCollectionResolutionForTesting,
  wrapAngularDevkitSchematic,
} from 'nx/src/commands/ngcli-adapter';
import { findNodes } from '@nrwl/workspace/src/utils/ast-utils';
import * as ts from 'typescript';
import { SyntaxKind } from 'typescript';
import { getTsSourceFile } from '../../utils/nx-devkit/ast-utils';
import { nxVersion } from '../../utils/versions';
import { storybookConfigurationGenerator } from '../storybook-configuration/storybook-configuration';
import { angularMigrateStoriesTo62Generator } from './migrate-stories-to-6-2';
import libraryGenerator from '../library/library';

const componentSchematic = wrapAngularDevkitSchematic(
  '@schematics/angular',
  'component'
);

describe('migrate-stories-to-6-2 schematic', () => {
  let appTree: Tree;

  describe('angular project', () => {
    beforeEach(async () => {
      overrideCollectionResolutionForTesting({
        '@nrwl/storybook': joinPathFragments(
          __dirname,
          '../../../../storybook/generators.json'
        ),
      });

      appTree = createTreeWithEmptyWorkspace();

      await libraryGenerator(appTree, {
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

      await storybookConfigurationGenerator(appTree, {
        name: 'test-ui-lib',
        configureCypress: true,
        generateCypressSpecs: true,
        generateStories: true,
        linter: Linter.EsLint,
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
      await angularMigrateStoriesTo62Generator(appTree);
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
