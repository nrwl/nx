import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree } from '@angular-devkit/schematics';

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
  });

  it('should create files (preset = fullstack)', async () => {
    const tree = await schematicRunner
      .runSchematicAsync(
        'ng-new',
        { name: 'proj', preset: 'fullstack' },
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
