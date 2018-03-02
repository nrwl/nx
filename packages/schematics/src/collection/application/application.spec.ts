import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '../../../../shared/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';

describe('application', () => {
  const schematicRunner = new SchematicTestRunner('@nrwl/schematics', path.join(__dirname, '../../collection.json'));

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
  });

  it('should generate files', () => {
    const tree = schematicRunner.runSchematic('application', { name: 'myApp', directory: 'my-app' }, appTree);
    expect(tree.files).toEqual([
      '/my-app/README.md',
      '/my-app/.angular-cli.json',
      '/my-app/.editorconfig',
      '/my-app/.gitignore',
      '/my-app/apps/.gitkeep',
      '/my-app/karma.conf.js',
      '/my-app/libs/.gitkeep',
      '/my-app/package.json',
      '/my-app/protractor.conf.js',
      '/my-app/test.js',
      '/my-app/tsconfig.json',
      '/my-app/tsconfig.spec.json',
      '/my-app/tslint.json'
    ]);
  });

  it('should update package.json', () => {
    const tree = schematicRunner.runSchematic('application', { name: 'myApp', directory: 'my-app' }, appTree);
    const packageJson = JSON.parse(getFileContent(tree, '/my-app/package.json'));

    expect(packageJson.devDependencies['@nrwl/schematics']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/nx']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/store-devtools']).toBeDefined();
  });

  it('should set right npmScope', () => {
    const tree = schematicRunner.runSchematic('application', { name: 'myApp', directory: 'my-app' }, appTree);

    const angularCliJson = JSON.parse(getFileContent(tree, '/my-app/.angular-cli.json'));
    expect(angularCliJson.project.npmScope).toEqual('myApp');

    const tsconfigJson = JSON.parse(getFileContent(tree, '/my-app/tsconfig.json'));
    expect(tsconfigJson.compilerOptions.paths).toEqual({ '@myApp/*': ['libs/*'] });
  });
});
