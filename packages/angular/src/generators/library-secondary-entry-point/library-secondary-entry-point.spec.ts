import 'nx/src/internal-testing-utils/mock-project-graph';

import * as devkit from '@nx/devkit';
import { addProjectConfiguration, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { generateTestLibrary } from '../utils/testing';
import { librarySecondaryEntryPointGenerator } from './library-secondary-entry-point';

describe('librarySecondaryEntryPoint generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should throw when the library does not exist in the workspace', async () => {
    await expect(() =>
      librarySecondaryEntryPointGenerator(tree, {
        name: 'testing',
        library: 'lib1',
        skipFormat: true,
      })
    ).rejects.toThrow();
  });

  it('should throw when the project specified as a library it is not a library', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    await expect(() =>
      librarySecondaryEntryPointGenerator(tree, {
        name: 'testing',
        library: 'app1',
        skipFormat: true,
      })
    ).rejects.toThrow();
  });

  it('should throw when the folder where the secondary entry point should be generate already exists', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
    });
    tree.write(
      'libs/lib1/package.json',
      JSON.stringify({ name: '@my-org/lib1' })
    );
    tree.write('libs/lib1/testing/ng-package.json', '');

    await expect(() =>
      librarySecondaryEntryPointGenerator(tree, {
        name: 'testing',
        library: 'lib1',
        skipFormat: true,
      })
    ).rejects.toThrow();
  });

  it('should generate files for the secondary entry point', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
    });
    tree.write(
      'libs/lib1/package.json',
      JSON.stringify({ name: '@my-org/lib1' })
    );

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    expect(tree.exists('libs/lib1/testing/ng-package.json')).toBeTruthy();
    expect(tree.exists('libs/lib1/testing/README.md')).toBeTruthy();
    expect(tree.exists('libs/lib1/testing/src/index.ts')).toBeTruthy();
    expect(
      tree.exists('libs/lib1/testing/src/lib/testing.module.ts')
    ).toBeTruthy();
    expect(
      tree.read('libs/lib1/testing/src/index.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should configure the entry file', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
    });
    tree.write(
      'libs/lib1/package.json',
      JSON.stringify({ name: '@my-org/lib1' })
    );

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    const ngPackageJson = readJson(tree, 'libs/lib1/testing/ng-package.json');
    expect(ngPackageJson.lib.entryFile).toBe('src/index.ts');
  });

  it('should add the path mapping for the entry point', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
    });
    tree.write(
      'libs/lib1/package.json',
      JSON.stringify({ name: '@my-org/lib1' })
    );

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    const tsConfig = readJson(tree, 'tsconfig.base.json');
    expect(
      tsConfig.compilerOptions.paths['@my-org/lib1/testing']
    ).toStrictEqual(['libs/lib1/testing/src/index.ts']);
  });

  it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
    });
    tree.write(
      'libs/lib1/package.json',
      JSON.stringify({ name: '@my-org/lib1' })
    );

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    const tsConfig = readJson(tree, 'tsconfig.json');
    expect(
      tsConfig.compilerOptions.paths['@my-org/lib1/testing']
    ).toStrictEqual(['libs/lib1/testing/src/index.ts']);
  });

  it('should update the tsconfig "include" and "exclude" options', async () => {
    await generateTestLibrary(tree, {
      name: 'lib1',
      directory: 'libs/lib1',
      importPath: '@my-org/lib1',
      publishable: true,
      skipFormat: true,
    });
    // verify initial state
    let tsConfig = readJson(tree, 'libs/lib1/tsconfig.lib.json');
    expect(tsConfig.include).toStrictEqual(['src/**/*.ts']);
    expect(tsConfig.exclude).toStrictEqual([
      'src/**/*.spec.ts',
      'src/test-setup.ts',
      'jest.config.ts',
      'src/**/*.test.ts',
    ]);

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    tsConfig = readJson(tree, 'libs/lib1/tsconfig.lib.json');
    expect(tsConfig.include).toStrictEqual(['**/*.ts']);
    expect(tsConfig.exclude).toStrictEqual([
      '**/*.spec.ts',
      'test-setup.ts',
      'jest.config.ts',
      '**/*.test.ts',
    ]);
  });

  it('should format files', async () => {
    jest.spyOn(devkit, 'formatFiles');
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
    });
    tree.write(
      'libs/lib1/package.json',
      JSON.stringify({ name: '@my-org/lib1' })
    );

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
    });

    expect(devkit.formatFiles).toHaveBeenCalled();
    expect(
      tree.read('libs/lib1/testing/src/index.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('libs/lib1/testing/src/lib/testing.module.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  describe('--skipModule', () => {
    it('should not generate a module', async () => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        projectType: 'library',
      });
      tree.write(
        'libs/lib1/package.json',
        JSON.stringify({ name: '@my-org/lib1' })
      );

      await librarySecondaryEntryPointGenerator(tree, {
        name: 'testing',
        library: 'lib1',
        skipModule: true,
        skipFormat: true,
      });

      expect(
        tree.exists('libs/lib1/testing/src/lib/testing.module.ts')
      ).toBeFalsy();
      expect(tree.exists('libs/lib1/testing/ng-package.json')).toBeTruthy();
      expect(tree.exists('libs/lib1/testing/README.md')).toBeTruthy();
      expect(tree.exists('libs/lib1/testing/src/index.ts')).toBeTruthy();
      expect(
        tree.read('libs/lib1/testing/src/index.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});
