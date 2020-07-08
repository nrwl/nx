import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { join } from 'path';

import { NestSchematicsSchema } from './schema';

describe('schematics schematic', () => {
  let appTree: Tree;
  const options: NestSchematicsSchema = {
    name: 'test',
    unitTestRunner: 'jest',
    type: 'class',
    project: '',
  };

  const testRunner = new SchematicTestRunner(
    '@nrwl/schematics',
    join(__dirname, '../../../collection.json')
  );

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  it('should run successfully', async () => {
    await expect(
      testRunner.runSchematicAsync('schematics', options, appTree).toPromise()
    ).resolves.not.toThrowError();
  });
});
