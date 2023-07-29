import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { joinPathFragments, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { storybookVersion } from '../../../utils/versions';
import { findNodes } from '@nx/js';
import * as ts from 'typescript';
import { SyntaxKind } from 'typescript';
import { nxVersion } from '../../../utils/versions';
import { migrateStoriesTo62Generator } from './migrate-stories-to-6-2';
import {
  overrideCollectionResolutionForTesting,
  wrapAngularDevkitSchematic,
} from '@nx/devkit/ngcli-adapter';
import { getTsSourceFile } from '../../../utils/utilities';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

const componentSchematic = wrapAngularDevkitSchematic(
  '@schematics/angular',
  'component'
);
const runAngularLibrarySchematic = wrapAngularDevkitSchematic(
  '@schematics/angular',
  'library'
);

const runAngularStorybookSchematic = wrapAngularDevkitSchematic(
  '@nx/angular',
  'storybook-configuration'
);

describe('migrate-stories-to-6-2 schematic', () => {
  let appTree: Tree;

  describe('angular project', () => {
    beforeEach(async () => {
      overrideCollectionResolutionForTesting({
        '@nx/storybook': joinPathFragments(
          __dirname,
          '../../../../generators.json'
        ),
      });

      appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      await runAngularLibrarySchematic(appTree, {
        name: 'test-ui-lib',
      });

      await componentSchematic(appTree, {
        name: 'test-button',
        project: 'test-ui-lib',
      });

      writeJson(appTree, 'package.json', {
        devDependencies: {
          '@nx/storybook': nxVersion,
          '@storybook/addon-knobs': storybookVersion,
          '@storybook/angular': storybookVersion,
        },
      });
      writeJson(appTree, 'test-ui-lib/tsconfig.json', {});

      await runAngularStorybookSchematic(appTree, {
        name: 'test-ui-lib',
        configureCypress: true,
        configureStaticServe: false,
      });

      appTree.write(
        `test-ui-lib/src/lib/test-button/test-button.component.stories.ts`,
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

      /**
       * This needs to be updated for the following reason:
       * - runAngularStorybookSchematic now generates the Storybook targets in
       *   the project configuration using the @storybook/angular executors
       * - this means that the uiFramework property is not used any more
       * - that property was used in versions before that so the migration script looks for it
       * - the migrate-stories-to-6-2 migrator should have already taken effect in previous versions
       *   so there is no need to update the generator to look for the new executor as well
       */
      const projectConfig = readProjectConfiguration(appTree, 'test-ui-lib');
      projectConfig.targets.storybook.options.uiFramework =
        '@storybook/angular';
      projectConfig.targets.storybook.options.config = {
        configFolder: projectConfig.targets.storybook.options.configDir,
      };
      updateProjectConfiguration(appTree, 'test-ui-lib', projectConfig);
    });

    it('should move the component from the story to parameters.component', async () => {
      await migrateStoriesTo62Generator(appTree);
      const storyFilePath =
        'test-ui-lib/src/lib/test-button/test-button.component.stories.ts';
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
