import type { MockInstance } from 'vitest';
import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { generateTestLibrary } from '../utils/testing';
import { librarySecondaryEntryPointGenerator } from './library-secondary-entry-point';
import * as devkitModule from '@nx/devkit';

describe('librarySecondaryEntryPoint generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
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
    expect(readJson(tree, 'libs/lib1/package.json').exports).toBeUndefined();
    expect(tree.exists('libs/lib1/testing/README.md')).toBeTruthy();
    expect(tree.exists('libs/lib1/testing/src/index.ts')).toBeTruthy();
    expect(
      tree.exists('libs/lib1/testing/src/lib/testing-module.ts')
    ).toBeTruthy();
    expect(
      tree.read('libs/lib1/testing/src/index.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate the module file respecting the "typeSeparator" generator default', async () => {
    const nxJson = readNxJson(tree);
    nxJson.generators = {
      ...nxJson.generators,
      '@nx/angular:module': {
        typeSeparator: '.',
      },
    };
    updateNxJson(tree, nxJson);
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

    expect(tree.exists('libs/lib1/testing/src/lib/testing.module.ts')).toBe(
      true
    );
    expect(tree.read('libs/lib1/testing/src/index.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export * from './lib/testing.module';
      "
    `);
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

  it.each([
    [
      'a build target using @nx/angular:library',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:library' } },
        });
      },
    ],
    [
      'a build target using @angular/build:library',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@angular/build:library' } },
        });
      },
    ],
    [
      'no build target and another target using the library builder',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { package: { executor: '@nx/angular:library' } },
        });
      },
    ],
    [
      'a library builder target and an angular.json without projects',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:library' } },
        });
        writeJson(tree, 'angular.json', { version: 1 });
      },
    ],
    [
      'a library builder target next to another library using ng-packagr',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:library' } },
        });
        addProjectConfiguration(tree, 'lib2', {
          root: 'libs/lib2',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:package' } },
        });
      },
    ],
  ])(
    'should add a package.json export instead of an ng-package.json for a library with %s',
    async (_, setUpProject) => {
      writeJson(tree, 'libs/lib1/package.json', {
        name: '@my-org/lib1',
        exports: { '.': './src/index.ts' },
      });
      setUpProject(tree);

      await librarySecondaryEntryPointGenerator(tree, {
        name: 'testing',
        library: 'lib1',
        skipFormat: true,
      });

      expect(readJson(tree, 'libs/lib1/package.json').exports).toStrictEqual({
        '.': './src/index.ts',
        './testing': './testing/src/index.ts',
      });
      expect(tree.exists('libs/lib1/testing/ng-package.json')).toBe(false);
    }
  );

  it('should keep the ng-package.json layout when the build target uses ng-packagr next to a library builder target', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
      targets: {
        build: { executor: '@nx/angular:package' },
        preview: { executor: '@angular/build:library' },
      },
    });
    writeJson(tree, 'libs/lib1/package.json', {
      name: '@my-org/lib1',
      exports: { '.': './src/index.ts' },
    });

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    expect(tree.exists('libs/lib1/testing/ng-package.json')).toBe(true);
    expect(readJson(tree, 'libs/lib1/package.json').exports).toStrictEqual({
      '.': './src/index.ts',
    });
  });

  it.each([
    [
      'a target using ng-packagr',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: {
            build: { executor: '@nx/angular:library' },
            legacy: { executor: '@nx/angular:package' },
          },
        });
      },
      'legacy',
      'libs/lib1/project.json',
    ],
    [
      'a target inheriting ng-packagr through targetDefaults',
      (tree: Tree) => {
        updateNxJson(tree, {
          ...readNxJson(tree),
          targetDefaults: { legacy: { executor: '@nx/angular:package' } },
        });
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: {
            build: { executor: '@nx/angular:library' },
            legacy: {},
          },
        });
      },
      'legacy',
      'libs/lib1/project.json',
    ],
    [
      'an ng-packagr target in package.json next to project.json',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:library' } },
        });
        updateJson(tree, 'libs/lib1/package.json', (json) => ({
          ...json,
          nx: { targets: { legacy: { executor: '@nx/angular:package' } } },
        }));
      },
      'legacy',
      'libs/lib1/package.json',
    ],
    [
      'an ng-packagr target in a project.json outside the library root',
      (tree: Tree) => {
        writeJson(tree, 'configs/lib1/project.json', {
          name: 'lib1',
          root: 'libs/lib1',
          projectType: 'library',
          targets: {
            build: { executor: '@nx/angular:library' },
            legacy: { executor: '@nx/angular:package' },
          },
        });
      },
      'legacy',
      'configs/lib1/project.json',
    ],
    [
      'an ng-packagr target in angular.json next to project.json',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:library' } },
        });
        writeJson(tree, 'angular.json', {
          version: 1,
          projects: {
            'cli-lib1': {
              root: 'libs/lib1',
              architect: { build: { builder: '@angular/build:ng-packagr' } },
            },
          },
        });
      },
      'build',
      'angular.json',
    ],
    [
      'an ng-packagr target in angular.json next to a project.json with a "./" root',
      (tree: Tree) => {
        writeJson(tree, 'libs/lib1/project.json', {
          name: 'lib1',
          root: './libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:library' } },
        });
        writeJson(tree, 'angular.json', {
          version: 1,
          projects: {
            'cli-lib1': {
              root: 'libs/lib1',
              architect: { legacy: { builder: '@angular/build:ng-packagr' } },
            },
          },
        });
      },
      'legacy',
      'angular.json',
    ],
    [
      'an ng-packagr target in an angular.json in a parent directory',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:library' } },
        });
        // @nx/angular/plugin reads an angular.json with a package.json next to it.
        updateJson(tree, 'nx.json', (json) => ({
          ...json,
          plugins: ['@nx/angular/plugin'],
        }));
        writeJson(tree, 'libs/package.json', { name: 'libs' });
        writeJson(tree, 'libs/angular.json', {
          version: 1,
          projects: {
            'cli-lib1': {
              root: 'lib1',
              architect: { build: { builder: '@angular/build:ng-packagr' } },
            },
          },
        });
      },
      'build',
      'libs/angular.json',
    ],
    [
      'an ng-packagr target in another project that reads its ng-package.json',
      (tree: Tree) => {
        addProjectConfiguration(tree, 'lib1', {
          root: 'libs/lib1',
          projectType: 'library',
          targets: { build: { executor: '@nx/angular:library' } },
        });
        writeJson(tree, 'libs/lib1/ng-package.json', {
          lib: { entryFile: 'src/index.ts' },
        });
        addProjectConfiguration(tree, 'proxy', {
          root: 'libs/proxy',
          projectType: 'library',
          targets: {
            build: {
              executor: '@nx/angular:ng-packagr-lite',
              options: { project: 'libs/lib1/ng-package.json' },
            },
          },
        });
      },
      'build',
      'libs/proxy/project.json',
    ],
  ])(
    'should throw without changing files when a library builder library has %s',
    async (_, setUpProject, target, file) => {
      writeJson(tree, 'libs/lib1/package.json', {
        name: '@my-org/lib1',
        exports: { '.': './src/index.ts' },
      });
      setUpProject(tree);
      const changes = tree.listChanges();

      await expect(
        librarySecondaryEntryPointGenerator(tree, {
          name: 'testing',
          library: 'lib1',
          skipFormat: true,
        })
      ).rejects.toThrow(
        `The "lib1" library uses the library builder, but the "${target}" target in "${file}" uses ng-packagr.`
      );
      expect(tree.listChanges()).toEqual(changes);
    }
  );

  it('should throw when an ng-packagr target reads the configuration of a library builder library through a symlink', async () => {
    const tempFs = new TempFs('library-secondary-entry-point');
    try {
      tree.root = tempFs.tempDir;
      tempFs.createFileSync(
        'libs/lib1/ng-package.json',
        JSON.stringify({ lib: { entryFile: 'src/index.ts' } })
      );
      symlinkSync(
        join(tempFs.tempDir, 'libs/lib1'),
        join(tempFs.tempDir, 'libs/link'),
        'junction'
      );
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        projectType: 'library',
        targets: { build: { executor: '@nx/angular:library' } },
      });
      writeJson(tree, 'libs/lib1/package.json', {
        name: '@my-org/lib1',
        exports: { '.': './src/index.ts' },
      });
      addProjectConfiguration(tree, 'proxy', {
        root: 'libs/proxy',
        projectType: 'library',
        targets: {
          build: {
            executor: '@nx/angular:ng-packagr-lite',
            options: { project: 'libs/link/ng-package.json' },
          },
        },
      });

      await expect(
        librarySecondaryEntryPointGenerator(tree, {
          name: 'testing',
          library: 'lib1',
          skipFormat: true,
        })
      ).rejects.toThrow(
        'The "lib1" library uses the library builder, but the "build" target in "libs/proxy/project.json" uses ng-packagr.'
      );
    } finally {
      tempFs.cleanup();
    }
  });

  it('should generate when an ng-packagr target only builds the library as a secondary entry point', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
      targets: { build: { executor: '@nx/angular:library' } },
    });
    writeJson(tree, 'libs/lib1/package.json', {
      name: '@my-org/lib1',
      exports: { '.': './src/index.ts' },
    });
    writeJson(tree, 'libs/lib1/ng-package.json', {
      lib: { entryFile: 'src/index.ts' },
    });
    // ng-packagr writes the exports of the primary entry point only.
    addProjectConfiguration(tree, 'all', {
      root: 'libs',
      projectType: 'library',
      targets: { build: { executor: '@nx/angular:package' } },
    });
    writeJson(tree, 'libs/ng-package.json', {});

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    expect(readJson(tree, 'libs/lib1/package.json').exports).toStrictEqual({
      '.': './src/index.ts',
      './testing': './testing/src/index.ts',
    });
  });

  it.each([
    ['a string', './src/index.ts'],
    ['a conditions object', { types: './index.d.ts', default: './index.mjs' }],
  ])(
    'should keep %s "exports" value as the primary entry point',
    async (_, primaryExport) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        projectType: 'library',
        targets: { build: { executor: '@nx/angular:library' } },
      });
      writeJson(tree, 'libs/lib1/package.json', {
        name: '@my-org/lib1',
        exports: primaryExport,
      });

      await librarySecondaryEntryPointGenerator(tree, {
        name: 'testing',
        library: 'lib1',
        skipFormat: true,
      });

      expect(readJson(tree, 'libs/lib1/package.json').exports).toStrictEqual({
        '.': primaryExport,
        './testing': './testing/src/index.ts',
      });
    }
  );

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
    ).toStrictEqual(['./libs/lib1/testing/src/index.ts']);
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
    ).toStrictEqual(['./libs/lib1/testing/src/index.ts']);
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
      'src/**/*.test.ts',
    ]);

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    tsConfig = readJson(tree, 'libs/lib1/tsconfig.lib.json');
    expect(tsConfig.include).toStrictEqual([
      'src/**/*.ts',
      'testing/src/**/*.ts',
    ]);
    expect(tsConfig.exclude).toStrictEqual([
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'testing/src/**/*.spec.ts',
      'testing/src/**/*.test.ts',
    ]);
  });

  it('should not modify non-glob exclude paths like "src/test-setup.ts"', async () => {
    await generateTestLibrary(tree, {
      name: 'lib1',
      directory: 'libs/lib1',
      importPath: '@my-org/lib1',
      publishable: true,
      skipFormat: true,
    });
    // Simulate jest setup adding src/test-setup.ts to exclude
    updateJson(tree, 'libs/lib1/tsconfig.lib.json', (json) => {
      json.exclude = [...(json.exclude ?? []), 'src/test-setup.ts'];
      return json;
    });
    // verify initial state
    let tsConfig = readJson(tree, 'libs/lib1/tsconfig.lib.json');
    expect(tsConfig.include).toStrictEqual(['src/**/*.ts']);
    expect(tsConfig.exclude).toStrictEqual([
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/test-setup.ts',
    ]);

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'testing',
      library: 'lib1',
      skipFormat: true,
    });

    tsConfig = readJson(tree, 'libs/lib1/tsconfig.lib.json');
    expect(tsConfig.include).toStrictEqual([
      'src/**/*.ts',
      'testing/src/**/*.ts',
    ]);
    expect(tsConfig.exclude).toStrictEqual([
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/test-setup.ts',
      'testing/src/**/*.spec.ts',
      'testing/src/**/*.test.ts',
    ]);
  });

  it('should not prefix globs that belong to existing secondary entry points', async () => {
    await generateTestLibrary(tree, {
      name: 'lib1',
      directory: 'libs/lib1',
      importPath: '@my-org/lib1',
      publishable: true,
      skipFormat: true,
    });

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'secondary1',
      library: 'lib1',
      skipFormat: true,
    });

    await librarySecondaryEntryPointGenerator(tree, {
      name: 'secondary2',
      library: 'lib1',
      skipFormat: true,
    });

    const tsConfig = readJson(tree, 'libs/lib1/tsconfig.lib.json');
    expect(tsConfig.include).toStrictEqual([
      'src/**/*.ts',
      'secondary1/src/**/*.ts',
      'secondary2/src/**/*.ts',
    ]);
    expect(tsConfig.exclude).toStrictEqual([
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
      'secondary1/src/**/*.spec.ts',
      'secondary1/src/**/*.test.ts',
      'secondary2/src/**/*.spec.ts',
      'secondary2/src/**/*.test.ts',
    ]);
  });

  describe('--skipFormat', () => {
    let formatFilesSpy: MockInstance;

    beforeEach(() => {
      formatFilesSpy = vi
        .spyOn(devkitModule, 'formatFiles')
        .mockImplementation(() => Promise.resolve());
    });

    afterAll(() => {
      vi.restoreAllMocks();
    });

    it('should format files', async () => {
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

      expect(formatFilesSpy).toHaveBeenCalled();
      expect(
        tree.read('libs/lib1/testing/src/index.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('libs/lib1/testing/src/lib/testing-module.ts', 'utf-8')
      ).toMatchSnapshot();
    });
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
        tree.exists('libs/lib1/testing/src/lib/testing-module.ts')
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
