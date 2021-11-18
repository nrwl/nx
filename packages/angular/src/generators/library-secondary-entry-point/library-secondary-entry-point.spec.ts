import * as devkit from '@nrwl/devkit';
import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { librarySecondaryEntryPointGenerator } from './library-secondary-entry-point';

describe('librarySecondaryEntryPoint generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should throw when the library does not exist in the workspace', async () => {
    await expect(() =>
      librarySecondaryEntryPointGenerator(tree, {
        name: 'testing',
        library: 'lib1',
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
    });

    const tsConfig = readJson(tree, 'tsconfig.base.json');
    expect(
      tsConfig.compilerOptions.paths['@my-org/lib1/testing']
    ).toStrictEqual(['libs/lib1/testing/src/index.ts']);
  });

  it('should add the entry point file patterns to the lint target', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
      targets: {
        lint: {
          executor: '',
          options: {
            lintFilePatterns: [
              'libs/lib1/src/**/*.ts',
              'libs/lib1/src/**/*.html',
            ],
          },
        },
      },
    });
    tree.write(
      'libs/lib1/package.json',
      JSON.stringify({ name: '@my-org/lib1' })
    );

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
    });

    const project = readProjectConfiguration(tree, 'lib1');
    expect(project.targets!.lint.options.lintFilePatterns).toEqual(
      expect.arrayContaining([
        'libs/lib1/testing/**/*.ts',
        'libs/lib1/testing/**/*.html',
      ])
    );
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
