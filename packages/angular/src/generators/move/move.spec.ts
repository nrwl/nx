import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { angularMoveGenerator } from './move';
import libraryGenerator from '../library/library';
import { Linter } from '@nrwl/workspace';
import { UnitTestRunner } from '../../utils/test-runners';

describe('@nrwl/angular:move', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'mylib',
      buildable: false,
      enableIvy: false,
      linter: Linter.EsLint,
      publishable: false,
      simpleModuleName: true,
      skipFormat: false,
      unitTestRunner: UnitTestRunner.Jest,
    });
  });

  it('should move a project', async () => {
    await angularMoveGenerator(tree, {
      projectName: 'mylib',
      destination: 'mynewlib',
      updateImportPath: true,
    });

    expect(tree.exists('libs/mynewlib/src/lib/mynewlib.module.ts')).toEqual(
      true
    );
  });
});
