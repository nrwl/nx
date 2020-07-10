import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

import { NestSchematicsSchema } from './schema';
import { runSchematic } from '../../utils/testing';

describe('nestjs-schematics schematic', () => {
  let appTree: Tree;
  const options: NestSchematicsSchema = {
    name: 'test',
    unitTestRunner: 'jest',
    type: 'class',
    project: '',
    flat: false,
  };

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  it('should run successfully', async () => {
    await expect(
      runSchematic('nestjs-schematics', options, appTree)
    ).resolves.not.toThrowError();
  });
});
