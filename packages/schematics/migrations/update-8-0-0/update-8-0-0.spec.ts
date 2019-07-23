import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { updateJsonInTree, readJsonInTree } from '@nrwl/workspace';

import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('Update 8-0-0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    initialTree = createEmptyWorkspace(Tree.empty());
    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
    initialTree = await schematicRunner
      .callRule(
        updateJsonInTree('package.json', json => ({
          scripts: {
            update: 'ng update @nrwl/schematics'
          },
          dependencies: {
            '@nrwl/nx': '7.8.1',
            '@nestjs/core': '5.6.0',
            express: '4.16.3',
            react: '16.8.3',
            '@angular/core': '^7.0.0'
          },
          devDependencies: {
            '@nrwl/schematics': '7.8.1',
            cypress: '3.1.0',
            jest: '24.1.0'
          }
        })),
        initialTree
      )
      .toPromise();
    initialTree = await schematicRunner
      .callRule(
        updateJsonInTree('tsconfig.json', json => ({
          compilerOptions: {}
        })),
        initialTree
      )
      .toPromise();
    initialTree = await schematicRunner
      .callRule(
        updateJsonInTree('tsconfig.app.json', json => ({
          compilerOptions: {
            outDir: '../../dist/out-tsc/apps/blah'
          }
        })),
        initialTree
      )
      .toPromise();
    initialTree = await schematicRunner
      .callRule(
        updateJsonInTree('workspace.json', json => ({
          projects: {
            'my-app': {
              architect: {
                cypress: {
                  builder: '@nrwl/builders:cypress',
                  options: {}
                },
                jest: {
                  builder: '@nrwl/builders:jest',
                  options: {}
                },
                nodeBuild: {
                  builder: '@nrwl/builders:node-build',
                  options: {}
                },
                nodeServe: {
                  builder: '@nrwl/builders:node-execute',
                  options: {}
                },
                webBuild: {
                  builder: '@nrwl/builders:web-build',
                  options: {}
                },
                webServe: {
                  builder: '@nrwl/builders:web-dev-server',
                  options: {}
                },
                runCommands: {
                  builder: '@nrwl/builders:run-commands',
                  options: {}
                }
              }
            }
          },
          cli: {
            defaultCollection: '@nrwl/schematics'
          }
        })),
        initialTree
      )
      .toPromise();
    initialTree = await schematicRunner
      .callRule(
        updateJsonInTree('tslint.json', json => ({
          rulesDirectory: ['node_modules/@nrwl/schematics/src/tslint'],
          rules: {}
        })),
        initialTree
      )
      .toPromise();
  });

  describe('imports', () => {
    it(`should be migrated from '@nrwl/nx' to '@nrwl/angular'`, async () => {
      initialTree.create(
        'file.ts',
        `
        import * from '@nrwl/nx';
        import * from '@nrwl/nx/testing';
        import { NxModule } from '@nrwl/nx';
        import { hot } from '@nrwl/nx/testing';
      `
      );

      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();
      expect(tree.readContent('file.ts')).toEqual(`
        import * from '@nrwl/angular';
        import * from '@nrwl/angular/testing';
        import { NxModule } from '@nrwl/angular';
        import { hot } from '@nrwl/angular/testing';
      `);
    });

    it(`should be migrated from '@nrwl/schematics' to '@nrwl/workspace'`, async () => {
      initialTree.create(
        'file.ts',
        `
        import * from '@nrwl/schematics/src/utils/fileutils';
        import { fileExists } from '@nrwl/schematics/src/utils/fileutils';
      `
      );

      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();
      expect(tree.readContent('file.ts')).toEqual(
        `
        import * from '@nrwl/workspace/src/utils/fileutils';
        import { fileExists } from '@nrwl/workspace/src/utils/fileutils';
      `
      );
    });
  });

  describe('builders', () => {
    it('should be migrated', async () => {
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();
      const { projects } = readJsonInTree(tree, 'workspace.json');
      const { architect } = projects['my-app'];
      expect(architect.cypress.builder).toEqual('@nrwl/cypress:cypress');
      expect(architect.jest.builder).toEqual('@nrwl/jest:jest');
      expect(architect.nodeBuild.builder).toEqual('@nrwl/node:build');
      expect(architect.nodeServe.builder).toEqual('@nrwl/node:execute');
      expect(architect.webBuild.builder).toEqual('@nrwl/web:build');
      expect(architect.webServe.builder).toEqual('@nrwl/web:dev-server');
      expect(architect.runCommands.builder).toEqual(
        '@nrwl/workspace:run-commands'
      );
    });
  });

  describe('update npm script', () => {
    it('should do ng update @nrwl/workspace', async () => {
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();
      const packageJson = readJsonInTree(tree, 'package.json');
      expect(packageJson.scripts.update).toEqual('ng update @nrwl/workspace');
    });
  });

  describe('set root dir', () => {
    it('should set root dir and update out dirs', async () => {
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();
      const rootTsConfig = readJsonInTree(tree, 'tsconfig.json');
      expect(rootTsConfig.compilerOptions.rootDir).toEqual('.');

      const appTsConfig = readJsonInTree(tree, 'tsconfig.app.json');
      expect(appTsConfig.compilerOptions.outDir).toEqual('../../dist/out-tsc');
    });
  });

  describe('jest config', () => {
    it('should have the plugin path migrated', async () => {
      initialTree.create(
        'jest.config.js',
        `
        module.exports = {
          resolver: '@nrwl/builders/plugins/jest/resolver',
        };
      `
      );
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();
      expect(tree.readContent('jest.config.js')).toContain(
        '@nrwl/jest/plugins/resolver'
      );
    });
  });

  describe('dependencies', () => {
    it('should change to the new dependencies', async () => {
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const { dependencies, devDependencies } = readJsonInTree(
        tree,
        'package.json'
      );
      expect(dependencies['@nrwl/nx']).not.toBeDefined();
      expect(devDependencies['@nrwl/schematics']).not.toBeDefined();
      expect(devDependencies['@nrwl/builders']).not.toBeDefined();
      expect(dependencies['@nrwl/angular']).toBeDefined();
      expect(devDependencies['@nrwl/express']).toBeDefined();
      expect(devDependencies['@nrwl/cypress']).toBeDefined();
      expect(devDependencies['@nrwl/jest']).toBeDefined();
      expect(devDependencies['@nrwl/nest']).toBeDefined();
      expect(devDependencies['@nrwl/node']).toBeDefined();
      expect(devDependencies['@nrwl/react']).toBeDefined();
      expect(devDependencies['@nrwl/web']).toBeDefined();
      expect(devDependencies['@nrwl/workspace']).toBeDefined();
    });
  });

  describe('lint rules', () => {
    it('should be migrated to `@nrwl/workspace`', async () => {
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const { rulesDirectory } = readJsonInTree(tree, 'tslint.json');
      expect(rulesDirectory).not.toContain(
        'node_modules/@nrwl/schematics/src/tslint'
      );
      expect(rulesDirectory).toContain(
        'node_modules/@nrwl/workspace/src/tslint'
      );
    });
  });

  describe('Nest dependencies', () => {
    it('should be updated to 6.x', async () => {
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const { dependencies, devDependencies } = readJsonInTree(
        tree,
        'package.json'
      );

      expect(dependencies['@nestjs/common']).toEqual('^6.2.4');
      expect(dependencies['@nestjs/core']).toEqual('^6.2.4');
      expect(dependencies['@nestjs/platform-express']).toEqual('^6.2.4');
      expect(dependencies['reflect-metadata']).toEqual('^0.1.12');
      expect(devDependencies['@nestjs/schematics']).toEqual('^6.3.0');
      expect(devDependencies['@nestjs/testing']).toEqual('^6.2.4');
    });
  });

  describe('defaultCollection', () => {
    it('should be set to @nrwl/angular if @angular/core is present', async () => {
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const defaultCollection = readJsonInTree(tree, 'workspace.json').cli
        .defaultCollection;
      expect(defaultCollection).toEqual('@nrwl/angular');
    });

    it('should be set to @nrwl/react if react is present', async () => {
      initialTree = await schematicRunner
        .callRule(
          updateJsonInTree('package.json', json => ({
            ...json,
            dependencies: {
              '@nestjs/core': '5.6.0',
              express: '4.16.3',
              react: '16.8.3'
            }
          })),
          initialTree
        )
        .toPromise();
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const defaultCollection = readJsonInTree(tree, 'workspace.json').cli
        .defaultCollection;
      expect(defaultCollection).toEqual('@nrwl/react');
    });

    it('should be set to @nrwl/nest if @nestjs/core is present', async () => {
      initialTree = await schematicRunner
        .callRule(
          updateJsonInTree('package.json', json => ({
            ...json,
            dependencies: {
              '@nestjs/core': '5.6.0',
              express: '4.16.3'
            }
          })),
          initialTree
        )
        .toPromise();
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const defaultCollection = readJsonInTree(tree, 'workspace.json').cli
        .defaultCollection;
      expect(defaultCollection).toEqual('@nrwl/nest');
    });

    it('should be set to @nrwl/express if express is present', async () => {
      initialTree = await schematicRunner
        .callRule(
          updateJsonInTree('package.json', json => ({
            ...json,
            dependencies: {
              express: '4.16.3'
            }
          })),
          initialTree
        )
        .toPromise();
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const defaultCollection = readJsonInTree(tree, 'workspace.json').cli
        .defaultCollection;
      expect(defaultCollection).toEqual('@nrwl/express');
    });

    it('should be set to @nrwl/express if express is present', async () => {
      initialTree = await schematicRunner
        .callRule(
          updateJsonInTree('package.json', json => ({
            ...json,
            dependencies: {
              express: '4.16.3'
            }
          })),
          initialTree
        )
        .toPromise();
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const defaultCollection = readJsonInTree(tree, 'workspace.json').cli
        .defaultCollection;
      expect(defaultCollection).toEqual('@nrwl/express');
    });

    it('should fallback to @nrwl/workspace', async () => {
      initialTree = await schematicRunner
        .callRule(
          updateJsonInTree('package.json', json => ({
            ...json,
            dependencies: {}
          })),
          initialTree
        )
        .toPromise();
      initialTree = await schematicRunner
        .callRule(
          updateJsonInTree('workspace.json', json => ({
            ...json,
            projects: {}
          })),
          initialTree
        )
        .toPromise();
      const tree = await schematicRunner
        .runSchematicAsync('update-8.0.0', {}, initialTree)
        .toPromise();

      const defaultCollection = readJsonInTree(tree, 'workspace.json').cli
        .defaultCollection;
      expect(defaultCollection).toEqual('@nrwl/workspace');
    });
  });
});
