import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace, runSchematic } from '../../utils/testing-utils';

describe('workspace-schematic', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'workspace-schematic',
      { name: 'custom' },
      appTree
    );
    expect(tree.exists('tools/schematics/custom/index.ts')).toBeTruthy();
    expect(tree.exists('tools/schematics/custom/schema.json')).toBeTruthy();
  });
});
