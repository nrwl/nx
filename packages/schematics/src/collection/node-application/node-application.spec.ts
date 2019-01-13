import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import {
  createEmptyWorkspace,
  schematicRunner
} from '../../utils/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';
import * as stripJsonComments from 'strip-json-comments';
import { readJsonInTree } from '../../utils/ast-utils';
import { NxJson } from '../../command-line/shared';

describe('node-app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update angular.json', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp' },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');
      const project = angularJson.projects['my-node-app'];
      expect(project.root).toEqual('apps/my-node-app');
      expect(project.architect).toEqual(
        jasmine.objectContaining({
          build: {
            builder: '@nrwl/builders:node-build',
            options: {
              outputPath: 'dist/apps/my-node-app',
              main: 'apps/my-node-app/src/main.ts',
              tsConfig: 'apps/my-node-app/tsconfig.app.json',
              assets: ['apps/my-node-app/src/assets']
            },
            configurations: {
              production: {
                optimization: true,
                extractLicenses: true,
                fileReplacements: [
                  {
                    replace: 'apps/my-node-app/src/environments/environment.ts',
                    with:
                      'apps/my-node-app/src/environments/environment.prod.ts'
                  }
                ]
              }
            }
          },
          serve: {
            builder: '@nrwl/builders:node-execute',
            options: {
              buildTarget: 'my-node-app:build'
            }
          }
        })
      );
      expect(angularJson.projects['my-node-app-e2e']).toBeUndefined();
    });

    it('should update nx.json', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-node-app': {
            tags: ['one', 'two']
          }
        }
      });
    });

    it('should generate files', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp' },
        appTree
      );
      expect(tree.exists(`apps/my-node-app/jest.config.js`)).toBeTruthy();
      expect(tree.exists('apps/my-node-app/src/main.ts')).toBeTruthy();

      expect(tree.readContent('apps/my-node-app/src/main.ts')).toContain(
        'const app = express();'
      );
      expect(tree.readContent('apps/my-node-app/src/main.ts')).toContain(
        'res.send(`Welcome to my-node-app!`);'
      );

      const tsconfig = readJsonInTree(tree, 'apps/my-node-app/tsconfig.json');
      expect(tsconfig.extends).toEqual('../../tsconfig.json');
      expect(tsconfig.compilerOptions.types).toContain('node');
      expect(tsconfig.compilerOptions.types).toContain('express');
      expect(tsconfig.compilerOptions.types).toContain('jest');

      const tsconfigApp = JSON.parse(
        stripJsonComments(
          getFileContent(tree, 'apps/my-node-app/tsconfig.app.json')
        )
      );
      expect(tsconfigApp.compilerOptions.outDir).toEqual(
        '../../dist/out-tsc/apps/my-node-app'
      );
      expect(tsconfigApp.extends).toEqual('./tsconfig.json');

      const tslintJson = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-node-app/tslint.json'))
      );
      expect(tslintJson.extends).toEqual('../../tslint.json');
    });

    it('should add dependencies', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp' },
        appTree
      );
      const packageJson = readJsonInTree(tree, 'package.json');
      expect(packageJson.dependencies.express).toBeDefined();
      expect(packageJson.devDependencies['@types/express']).toBeDefined();
    });
  });

  describe('nested', () => {
    it('should update angular.json', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp', directory: 'myDir' },
        appTree
      );
      const angularJson = readJsonInTree(tree, '/angular.json');

      expect(angularJson.projects['my-dir-my-node-app'].root).toEqual(
        'apps/my-dir/my-node-app'
      );
      expect(angularJson.projects['my-dir-my-node-app-e2e']).toBeUndefined();
    });

    it('should update nx.json', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp', directory: 'myDir', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-dir-my-node-app': {
            tags: ['one', 'two']
          }
        }
      });
    });

    it('should generate files', () => {
      const hasJsonValue = ({ path, expectedValue, lookupFn }) => {
        const content = getFileContent(tree, path);
        const config = JSON.parse(stripJsonComments(content));

        expect(lookupFn(config)).toEqual(expectedValue);
      };
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp', directory: 'myDir' },
        appTree
      );

      // Make sure these exist
      [
        `apps/my-dir/my-node-app/jest.config.js`,
        'apps/my-dir/my-node-app/src/main.ts'
      ].forEach(path => {
        expect(tree.exists(path)).toBeTruthy();
      });

      // Make sure these have properties
      [
        {
          path: 'apps/my-dir/my-node-app/tsconfig.json',
          lookupFn: json => json.extends,
          expectedValue: '../../../tsconfig.json'
        },
        {
          path: 'apps/my-dir/my-node-app/tsconfig.app.json',
          lookupFn: json => json.compilerOptions.outDir,
          expectedValue: '../../../dist/out-tsc/apps/my-dir/my-node-app'
        },
        {
          path: 'apps/my-dir/my-node-app/tsconfig.app.json',
          lookupFn: json => json.compilerOptions.types,
          expectedValue: ['node']
        },
        {
          path: 'apps/my-dir/my-node-app/tslint.json',
          lookupFn: json => json.extends,
          expectedValue: '../../../tslint.json'
        }
      ].forEach(hasJsonValue);
    });
  });

  describe('--unit-test-runner karma', () => {
    it('should be invalid', () => {
      expect(() => {
        schematicRunner.runSchematic(
          'node-app',
          { name: 'myNodeApp', unitTestRunner: 'karma' },
          appTree
        );
      }).toThrow();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp', unitTestRunner: 'none' },
        appTree
      );
      expect(tree.exists('apps/my-node-app/src/test-setup.ts')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/src/test.ts')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/tsconfig.spec.json')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/jest.config.js')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/karma.config.js')).toBeFalsy();
      const angularJson = readJsonInTree(tree, 'angular.json');
      expect(
        angularJson.projects['my-node-app'].architect.test
      ).toBeUndefined();
      expect(
        angularJson.projects['my-node-app'].architect.lint.options.tsConfig
      ).toEqual(['apps/my-node-app/tsconfig.app.json']);
    });
  });

  describe('--framework nest', () => {
    it('should create a main file', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        {
          name: 'myNestApp',
          framework: 'nestjs'
        },
        appTree
      );
      expect(tree.exists('apps/my-nest-app/src/main.ts')).toEqual(true);
    });

    it('should update dependencies', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        {
          name: 'myNestApp',
          framework: 'nestjs'
        },
        appTree
      );
      const { dependencies, devDependencies } = readJsonInTree(
        tree,
        'package.json'
      );
      expect(dependencies['@nestjs/common']).toBeDefined();
      expect(dependencies['@nestjs/core']).toBeDefined();
      expect(devDependencies['@nestjs/testing']).toBeDefined();
      expect(devDependencies['@nestjs/schematics']).toBeDefined();
    });
  });

  describe('--framework none', () => {
    it('should not generate any files', () => {
      const tree = schematicRunner.runSchematic(
        'node-app',
        { name: 'myNodeApp', framework: 'none' },
        appTree
      );
      expect(tree.exists('apps/my-node-app/src/main.ts')).toBeFalsy();
      expect(tree.exists('apps/my-node-app/src/app/.gitkeep')).toBeTruthy();
    });
  });
});
