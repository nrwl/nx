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
      schematicRunner.runSchematic('workspace', { name: 'myApp' }, appTree);
    }).toThrow('Cannot find package.json');
  });

  it('should error if no protractor.conf.js is present', () => {
    expect(() => {
      appTree.create('/package.json', JSON.stringify({}));
      schematicRunner.runSchematic('workspace', { name: 'myApp' }, appTree);
    }).toThrow('Cannot find protractor.conf.js');
  });

  it('should error if no .angular-cli.json is present', () => {
    expect(() => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create('/protractor.conf.js', '');
      schematicRunner.runSchematic('workspace', { name: 'myApp' }, appTree);
    }).toThrow('Cannot find .angular-cli.json');
  });

  it('should error if the .angular-cli.json specifies more than one app', () => {
    expect(() => {
      appTree.create('/package.json', JSON.stringify({}));
      appTree.create('/protractor.conf.js', '');
      appTree.create(
        '/.angular-cli.json',
        JSON.stringify({
          apps: [{}, {}]
        })
      );
      schematicRunner.runSchematic('workspace', { name: 'myApp' }, appTree);
    }).toThrow('Can only convert projects with one app');
  });
});
