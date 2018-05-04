import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';

xdescribe('workspace', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
  });

  it('should error if no package.json is present', () => {
    expect(() => {
      schematicRunner.runSchematic('ng-add', { name: 'myApp' }, appTree);
    }).toThrow('Cannot find package.json');
  });

  it('should error if no e2e/protractor.conf.js is present', () => {
    expect(() => {
      appTree.create('/package.json', JSON.stringify({}));
      schematicRunner.runSchematic('ng-add', { name: 'myApp' }, appTree);
    }).toThrow('Cannot find e2e/protractor.conf.js');
  });

  it('should error if no angular.json is present', () => {
    expect(() => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create('/e2e/protractor.conf.js', '');
      schematicRunner.runSchematic('ng-add', { name: 'myApp' }, appTree);
    }).toThrow('Cannot find angular.json');
  });

  it('should error if the angular.json specifies more than one app', () => {
    expect(() => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create('/e2e/protractor.conf.js', '');
      appTree.create(
        '/angular.json',
        JSON.stringify({
          projects: {
            proj1: {},
            'proj1-e2e': {},
            proj2: {},
            'proj2-e2e': {}
          }
        })
      );
      schematicRunner.runSchematic('ng-add', { name: 'myApp' }, appTree);
    }).toThrow('Can only convert projects with one app');
  });
});
