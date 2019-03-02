import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree } from '@angular-devkit/schematics';
import { Framework } from '../../utils/frameworks';

describe('ng-new', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let projectTree: Tree;

  beforeEach(() => {
    projectTree = Tree.empty();
  });

  it('should create files (preset = angular)', async () => {
    const tree = await schematicRunner
      .runSchematicAsync(
        'ng-new',
        { name: 'proj', preset: 'angular' },
        projectTree
      )
      .toPromise();
    expect(tree.exists('/proj/apps/proj/src/app/app.component.ts')).toBe(true);

    expect(
      JSON.parse(tree.readContent('/proj/angular.json')).schematics[
        '@nrwl/schematics:application'
      ].framework
    ).toBe(Framework.Angular);
  });

  it('should create files (preset = react)', async () => {
    const tree = await schematicRunner
      .runSchematicAsync(
        'ng-new',
        { name: 'proj', preset: 'react' },
        projectTree
      )
      .toPromise();
    expect(tree.exists('/proj/apps/proj/src/main.tsx')).toBe(true);
    expect(
      JSON.parse(tree.readContent('/proj/angular.json')).schematics[
        '@nrwl/schematics:application'
      ].framework
    ).toBe(Framework.React);
  });

  it('should create files (preset = web-components)', async () => {
    const tree = await schematicRunner
      .runSchematicAsync(
        'ng-new',
        { name: 'proj', preset: 'web-components' },
        projectTree
      )
      .toPromise();
    expect(tree.exists('/proj/apps/proj/src/main.ts')).toBe(true);
    expect(
      JSON.parse(tree.readContent('/proj/angular.json')).schematics[
        '@nrwl/schematics:application'
      ].framework
    ).toBe(Framework.WebComponents);
  });

  it('should create files (preset = full-stack)', async () => {
    const tree = await schematicRunner
      .runSchematicAsync(
        'ng-new',
        { name: 'proj', preset: 'full-stack' },
        projectTree
      )
      .toPromise();
    expect(tree.exists('/proj/apps/proj/src/app/app.component.ts')).toBe(true);
    expect(tree.exists('/proj/apps/api/src/app/app.controller.ts')).toBe(true);
    expect(tree.exists('/proj/libs/api-interface/src/lib/interfaces.ts')).toBe(
      true
    );
  });
});
