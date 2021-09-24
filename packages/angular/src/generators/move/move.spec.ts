import { readJson, Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { angularMoveGenerator } from './move';
import libraryGenerator from '../library/library';
import { Linter } from '@nrwl/linter';
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

    jest.clearAllMocks();
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

  it('should update ng-package.json dest property', async () => {
    await libraryGenerator(tree, { name: 'mylib2', buildable: true });

    await angularMoveGenerator(tree, {
      projectName: 'mylib2',
      destination: 'mynewlib2',
      updateImportPath: true,
    });

    const ngPackageJson = readJson(tree, 'libs/mynewlib2/ng-package.json');
    expect(ngPackageJson.dest).toEqual('../../dist/libs/mynewlib2');
  });

  it('should format files', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await angularMoveGenerator(tree, {
      projectName: 'mylib',
      destination: 'mynewlib',
      updateImportPath: true,
    });

    expect(devkit.formatFiles).toHaveBeenCalled();
  });

  it('should not format files when --skipFormat=true', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await angularMoveGenerator(tree, {
      projectName: 'mylib',
      destination: 'mynewlib',
      updateImportPath: true,
      skipFormat: true,
    });

    expect(devkit.formatFiles).not.toHaveBeenCalled();
  });
});
