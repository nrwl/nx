import { callRule, runMigration } from '../../utils/testing';
import { chain, Tree } from '@angular-devkit/schematics';
import {
  readJsonInTree,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('update-10.4.0', () => {
  describe('update Protractor e2e tsconfig.json', () => {
    let tree: Tree;
    beforeAll(async () => {
      tree = Tree.empty();
      tree = createEmptyWorkspace(tree);
      tree = await callRule(
        updateWorkspace((workspace) => {
          workspace.projects.add({
            name: 'app1',
            root: 'apps/app1-e2e',
            projectType: 'application',
            targets: {
              e2e: {
                builder: '@angular-devkit/build-angular:protractor',
                options: {
                  protractorConfig: 'apps/app1-e2e/protractor.conf.js',
                  devServerTarget: 'testapp:serve',
                },
                configurations: {
                  production: {
                    devServerTarget: 'testapp:serve:production',
                  },
                },
              },
            },
          });
        }),
        tree
      );
      tree = await callRule(
        chain([
          updateJsonInTree('apps/app1-e2e/tsconfig.json', () => ({
            extends: '../../tsconfig.json',
          })),
        ]),
        tree
      );

      tree = await runMigration('update-10-4-0', {}, tree);
    });

    it('should update the protractor e2e tsconfig to correctly point to the tsconfig.base.json', async () => {
      const tsconfig = readJsonInTree(tree, 'apps/app1-e2e/tsconfig.json');
      expect(tsconfig.extends).toEqual('../../tsconfig.base.json');
    });
  });

  describe('update Protractor, Karma and Jasmine dependencies', () => {
    let tree: Tree;
    beforeAll(async () => {
      tree = Tree.empty();
      tree = createEmptyWorkspace(tree);

      tree = await callRule(
        chain([
          // update package.json to have the deps that are being upgraded
          updateJsonInTree('package.json', (json) => {
            json.devDependencies = {
              ...json.devDependencies,
              protractor: '1.0.0',
              'jasmine-core': '1.0.0',
              'jasmine-spec-reporter': '1.0.0',
              '@types/jasmine': '1.0.0',
              karma: '1.0.0',
              'karma-chrome-launcher': '1.0.0',
              'karma-coverage-istanbul-reporter': '1.0.0',
              'karma-jasmine': '1.0.0',
              'karma-jasmine-html-reporter': '1.0.0',
            };
            return json;
          }),
        ]),
        tree
      );

      tree = await runMigration('update-10-4-0', {}, tree);
    });

    it('should update the karma, jasmine and protractor dependencies', async () => {
      const packageJson = readJsonInTree(tree, 'package.json');

      expect(packageJson.devDependencies['protractor']).toEqual('~7.0.0');
      expect(packageJson.devDependencies['jasmine-core']).toEqual('~3.6.0');
      expect(packageJson.devDependencies['jasmine-spec-reporter']).toEqual(
        '~5.0.0'
      );
      expect(packageJson.devDependencies['@types/jasmine']).toEqual('~3.5.0');
      expect(packageJson.devDependencies['karma']).toEqual('~5.0.0');
      expect(packageJson.devDependencies['karma-chrome-launcher']).toEqual(
        '~3.1.0'
      );
      expect(
        packageJson.devDependencies['karma-coverage-istanbul-reporter']
      ).toEqual('~3.0.2');
      expect(packageJson.devDependencies['karma-jasmine']).toEqual('~4.0.0');
      expect(
        packageJson.devDependencies['karma-jasmine-html-reporter']
      ).toEqual('^1.5.0');
    });
  });
});
