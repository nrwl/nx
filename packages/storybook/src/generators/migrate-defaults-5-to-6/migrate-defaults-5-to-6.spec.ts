import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import {
  callRule,
  createTestUILib,
  runSchematic,
  runExternalSchematic,
} from '../../utils/testing';
import { storybookVersion } from '../../utils/versions';

// TODO: migrate these tests when schematics are moved over to generators
// These Tests would fail if rewritten with @nrwl/devkit
// Keeping these as is so we can still test teh functionality
describe('migrate-defaults-5-to-6 schematic', () => {
  let appTree: Tree;

  describe('angular project', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib1', '@nrwl/angular');

      appTree = await callRule(
        updateJsonInTree('package.json', (json) => {
          return {
            ...json,
            devDependencies: {
              ...json.devDependencies,
              '@nrwl/storybook': '10.4.0',
              '@nrwl/workspace': '10.4.0',
              '@storybook/addon-knobs': '^5.3.8',
              '@storybook/angular': '^5.3.8',
            },
          };
        }),
        appTree
      );

      appTree = await runExternalSchematic(
        '@nrwl/angular',
        'library',
        {
          name: 'test-ui-lib2',
        },
        appTree
      );

      appTree = await runSchematic(
        'configuration',
        {
          name: 'test-ui-lib1',
        },
        appTree
      );

      appTree = await runSchematic(
        'configuration',
        {
          name: 'test-ui-lib2',
        },
        appTree
      );
    });

    describe('a single project run', () => {
      it('should not update dependencies when a single project is run', async () => {
        appTree = await runSchematic(
          'migrate-defaults-5-to-6',
          {
            name: 'test-ui-lib1',
          },
          appTree
        );
        const packageJson = readJsonInTree(appTree, 'package.json');
        // general deps
        expect(packageJson.devDependencies['@storybook/angular']).toEqual(
          '^5.3.8'
        );
        expect(packageJson.devDependencies['@storybook/addon-knobs']).toEqual(
          '^5.3.8'
        );
      });

      it('should update that project and leave others unchanged', async () => {
        appTree = await runSchematic(
          'migrate-defaults-5-to-6',
          {
            name: 'test-ui-lib1',
          },
          appTree
        );

        expect(
          appTree.exists('libs/test-ui-lib1/.old_storybook/addons.js')
        ).toBeTruthy();
        expect(
          appTree.exists('libs/test-ui-lib2/.old_storybook/addons.js')
        ).toBeFalsy();
      });

      it('should not update the root config', async () => {
        appTree = await runSchematic(
          'migrate-defaults-5-to-6',
          {
            name: 'test-ui-lib1',
          },
          appTree
        );

        expect(appTree.exists('.storybook/addons.js')).toBeTruthy();

        expect(appTree.exists('.storybook/main.js')).toBeFalsy();
      });
    });

    describe('all projects run', () => {
      it('should update dependencies', async () => {
        appTree = await runSchematic('migrate-defaults-5-to-6', {}, appTree);
        const packageJson = readJsonInTree(appTree, 'package.json');
        // general deps
        expect(packageJson.devDependencies['@storybook/angular']).toEqual(
          storybookVersion
        );
        expect(packageJson.devDependencies['@storybook/addon-knobs']).toEqual(
          storybookVersion
        );
      });

      it('should update root config', async () => {
        appTree = await runSchematic(
          'migrate-defaults-5-to-6',
          {
            all: true,
          },
          appTree
        );

        expect(appTree.exists('.storybook/addons.js')).toBeFalsy();

        expect(appTree.exists('.storybook/main.js')).toBeTruthy();
      });

      it('should update all projects', async () => {
        appTree = await runSchematic(
          'migrate-defaults-5-to-6',
          {
            all: true,
          },
          appTree
        );

        expect(
          appTree.exists('libs/test-ui-lib1/.old_storybook/addons.js')
        ).toBeTruthy();
        expect(
          appTree.exists('libs/test-ui-lib2/.old_storybook/addons.js')
        ).toBeTruthy();

        expect(
          appTree.exists('libs/test-ui-lib1/.storybook/main.js')
        ).toBeTruthy();
        expect(
          appTree.exists('libs/test-ui-lib2/.storybook/main.js')
        ).toBeTruthy();
      });
    });

    describe('--keepOld', () => {
      it('should keep old files by default', async () => {
        appTree = await runSchematic('migrate-defaults-5-to-6', {}, appTree);
        expect(
          appTree.exists('libs/test-ui-lib1/.old_storybook/addons.js')
        ).toBeTruthy();
        expect(
          appTree.exists('libs/test-ui-lib1/.old_storybook/config.js')
        ).toBeTruthy();

        expect(
          appTree.exists('libs/test-ui-lib2/.old_storybook/addons.js')
        ).toBeTruthy();
        expect(
          appTree.exists('libs/test-ui-lib2/.old_storybook/config.js')
        ).toBeTruthy();

        expect(appTree.exists('.old_storybook/addons.js')).toBeTruthy();
      });

      it('should delete old files when set to false', async () => {
        appTree = await runSchematic(
          'migrate-defaults-5-to-6',
          {
            keepOld: false,
          },
          appTree
        );
        expect(
          appTree.exists('libs/test-ui-lib1/.storybook/addons.js')
        ).toBeFalsy();
        expect(
          appTree.exists('libs/test-ui-lib1/.storybook/config.js')
        ).toBeFalsy();

        expect(
          appTree.exists('libs/test-ui-lib2/.storybook/addons.js')
        ).toBeFalsy();
        expect(
          appTree.exists('libs/test-ui-lib2/.storybook/config.js')
        ).toBeFalsy();

        expect(appTree.exists('.storybook/addons.js')).toBeFalsy();
      });
    });
  });

  describe('react project', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib1', '@nrwl/react');

      appTree = await callRule(
        updateJsonInTree('package.json', (json) => {
          return {
            ...json,
            devDependencies: {
              ...json.devDependencies,
              '@nrwl/storybook': '10.4.0',
              '@nrwl/workspace': '10.4.0',
              '@storybook/addon-knobs': '^5.3.8',
              '@storybook/react': '^5.3.8',
            },
          };
        }),
        appTree
      );

      appTree = await runExternalSchematic(
        '@nrwl/react',
        'library',
        {
          name: 'test-ui-lib2',
        },
        appTree
      );

      appTree = await runSchematic(
        'configuration',
        {
          name: 'test-ui-lib1',
        },
        appTree
      );

      appTree = await runSchematic(
        'configuration',
        {
          name: 'test-ui-lib2',
        },
        appTree
      );
    });

    describe('a single project run', () => {
      it('should not update dependencies when a single project is run', async () => {
        appTree = await runSchematic(
          'migrate-defaults-5-to-6',
          {
            name: 'test-ui-lib1',
          },
          appTree
        );
        const packageJson = readJsonInTree(appTree, 'package.json');
        // general deps
        expect(packageJson.devDependencies['@storybook/react']).toEqual(
          '^5.3.8'
        );
        expect(packageJson.devDependencies['@storybook/addon-knobs']).toEqual(
          '^5.3.8'
        );
      });
    });

    describe('all projects run', () => {
      it('should update dependencies', async () => {
        appTree = await runSchematic('migrate-defaults-5-to-6', {}, appTree);
        const packageJson = readJsonInTree(appTree, 'package.json');
        // general deps
        expect(packageJson.devDependencies['@storybook/react']).toEqual(
          storybookVersion
        );
        expect(packageJson.devDependencies['@storybook/addon-knobs']).toEqual(
          storybookVersion
        );
      });
    });
  });
});
