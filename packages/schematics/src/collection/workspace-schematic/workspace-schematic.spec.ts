import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '../../utils/testing-utils';

describe('workspace-schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    path.join(__dirname, '../../collection.json')
  );

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);

    schematicRunner.logger.subscribe(s => console.log(s));
  });

  it('should generate files', () => {
    const tree = schematicRunner.runSchematic(
      'workspace-schematic',
      { name: 'custom' },
      appTree
    );
    expect(tree.exists('tools/schematics/custom/index.ts')).toBeTruthy();
    expect(tree.exists('tools/schematics/custom/schema.json')).toBeTruthy();
  });
});
