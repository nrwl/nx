import * as devkit from '@nx/devkit';
import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { UnitTestRunner } from '../../utils/test-runners';
import librarySecondaryEntryPointGenerator from '../library-secondary-entry-point/library-secondary-entry-point';
import { generateTestLibrary } from '../utils/testing';
import { angularMoveGenerator } from './move';

describe('@nx/angular:move', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await generateTestLibrary(tree, {
      name: 'mylib',
      buildable: false,
      linter: Linter.EsLint,
      publishable: false,
      simpleName: true,
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
    await generateTestLibrary(tree, { name: 'mylib2', buildable: true });

    await angularMoveGenerator(tree, {
      projectName: 'mylib2',
      destination: 'mynewlib2',
      updateImportPath: true,
    });

    const ngPackageJson = readJson(tree, 'libs/mynewlib2/ng-package.json');
    expect(ngPackageJson.dest).toEqual('../../dist/libs/mynewlib2');
  });

  it('should update secondary entry points readme file', async () => {
    await generateTestLibrary(tree, { name: 'mylib2', buildable: true });
    await librarySecondaryEntryPointGenerator(tree, {
      library: 'mylib2',
      name: 'testing',
    });

    await angularMoveGenerator(tree, {
      projectName: 'mylib2',
      destination: 'mynewlib2',
      updateImportPath: true,
    });

    const readme = tree.read('libs/mynewlib2/testing/README.md', 'utf-8');
    expect(readme).toMatchInlineSnapshot(`
      "# @proj/mynewlib2/testing

      Secondary entry point of \`@proj/mynewlib2\`. It can be used by importing from \`@proj/mynewlib2/testing\`.
      "
    `);
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
