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
    project: 'api',
    flat: false,
  };

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
    appTree.overwrite(
      'workspace.json',
      String.raw`
      {
        "projects": {
         "api": {
            "root": "apps/api",
            "sourceRoot": "apps/api/src",
            "projectType": "application",
            "prefix": "api",
            "schematics": {},
            "architect":{}
         }
        }
      }
    `
    );
  });

  const testTypes: NestSchematicsSchema['type'][] = [
    'class',
    'controller',
    'decorator',
    'filter',
    'gateway',
    'guard',
    'interceptor',
    'interface',
    'middleware',
    'module',
    'pipe',
    'provider',
    'resolver',
    'service',
  ];

  test.each(testTypes)('%p should run successfully', async (type) => {
    await expect(
      runSchematic(type, options, appTree)
    ).resolves.not.toThrowError();
  });
});
