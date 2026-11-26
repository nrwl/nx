import {
  addProjectConfiguration,
  logger,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { generateTestLibrary } from '../utils/testing';
import { convertToLibraryExecutor } from './convert-to-library-executor';

describe('convert-to-library-executor generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    setAngularVersions({ core: '~22.3.0', build: '~22.3.0' });
  });

  it.each`
    executor                                      | expected
    ${'@nx/angular:package'}                      | ${'@nx/angular:library'}
    ${'@nx/angular:ng-packagr-lite'}              | ${'@nx/angular:library'}
    ${'@angular-devkit/build-angular:ng-packagr'} | ${'@angular/build:library'}
    ${'@angular/build:ng-packagr'}                | ${'@angular/build:library'}
  `(
    'should replace "$executor" with "$expected"',
    async ({ executor, expected }) => {
      addLibrary({ executor, options: { project: 'lib1/ng-package.json' } });

      await convertToLibraryExecutor(tree, {});

      const { build } = readProjectConfiguration(tree, 'lib1').targets;
      expect(build.executor).toBe(expected);
      expect(build.options.outputPath).toBe('dist/lib1');
    }
  );

  it.each`
    type             | productionConfiguration
    ${'buildable'}   | ${{ tsConfig: 'libs/lib1/tsconfig.lib.prod.json' }}
    ${'publishable'} | ${{ tsConfig: 'libs/lib1/tsconfig.lib.prod.json', compilationMode: 'partial' }}
  `(
    'should convert a $type library generated with ng-packagr and keep its compilation modes',
    async ({ type, productionConfiguration }) => {
      setAngularVersions({ core: '~22.2.0', build: '~22.2.0' });
      await generateTestLibrary(tree, {
        directory: 'libs/lib1',
        [type]: true,
        importPath: '@proj/lib1',
        skipFormat: true,
      });
      setAngularVersions({ core: '~22.3.0', build: '~22.3.0' });

      await convertToLibraryExecutor(tree, {});

      expect(
        readProjectConfiguration(tree, 'lib1').targets.build
      ).toStrictEqual({
        executor: '@nx/angular:library',
        outputs: ['{options.outputPath}'],
        options: {
          tsConfig: 'libs/lib1/tsconfig.lib.json',
          outputPath: 'dist/libs/lib1',
          compilationMode: 'full',
        },
        configurations: {
          production: productionConfiguration,
          development: {},
        },
        defaultConfiguration: 'production',
      });
      expect(tree.exists('libs/lib1/ng-package.json')).toBe(false);
      expect(readJson(tree, 'libs/lib1/package.json').exports).toStrictEqual({
        '.': './src/index.ts',
      });
      expect(readNxJson(tree).targetDefaults['@nx/angular:library']).toEqual(
        expect.objectContaining({ cache: true, dependsOn: ['^build'] })
      );
      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@angular/build']).toBe('~22.3.0');
      expect(devDependencies['ng-packagr']).toBeUndefined();
      expect(devDependencies['less']).toBeUndefined();
    }
  );

  it('should export the secondary entry points from package.json', async () => {
    setAngularVersions({ core: '~22.2.0', build: '~22.2.0' });
    await generateTestLibrary(tree, {
      directory: 'libs/lib1',
      publishable: true,
      importPath: '@proj/lib1',
      skipFormat: true,
    });
    await librarySecondaryEntryPointGenerator(tree, {
      library: 'lib1',
      name: 'button',
      skipFormat: true,
    });
    // ng-packagr finds secondary entry points only by their ng-package.json.
    writeJson(tree, 'libs/lib1/legacy/package.json', {
      ngPackage: { lib: { entryFile: 'src/index.ts' } },
    });
    tree.write('libs/lib1/legacy/src/index.ts', '');
    setAngularVersions({ core: '~22.3.0', build: '~22.3.0' });

    await convertToLibraryExecutor(tree, {});

    expect(readJson(tree, 'libs/lib1/package.json').exports).toStrictEqual({
      '.': './src/index.ts',
      './button': './button/src/index.ts',
    });
    expect(tree.exists('libs/lib1/button/ng-package.json')).toBe(false);
    expect(
      readProjectConfiguration(tree, 'lib1').targets.build.options.assets
    ).toStrictEqual([
      { glob: 'README.md', input: 'libs/lib1/button', output: 'button' },
    ]);
  });

  it('should read the ng-packagr configuration from a project directory', async () => {
    addLibrary({
      executor: '@nx/angular:package',
      options: { project: 'lib1' },
      configurations: { production: { project: 'lib1/ng-package.json' } },
    });

    await convertToLibraryExecutor(tree, {});

    const { build } = readProjectConfiguration(tree, 'lib1').targets;
    expect(build.executor).toBe('@nx/angular:library');
    expect(build.options.outputPath).toBe('dist/lib1');
    expect(tree.exists('lib1/ng-package.json')).toBe(false);
  });

  it.each([
    {
      executor: '@angular/build:ng-packagr',
      option: 'an empty',
      project: () => '',
      expected: '@angular/build:library',
    },
    {
      executor: '@nx/angular:package',
      option: 'an absolute',
      project: () => `${tree.root}/lib1/ng-package.json`,
      expected: '@nx/angular:library',
    },
  ])(
    'should convert a "$executor" target with $option project option',
    async ({ executor, project, expected }) => {
      addLibrary({ executor, options: { project: project() } });

      await convertToLibraryExecutor(tree, { project: 'lib1' });

      expect(
        readProjectConfiguration(tree, 'lib1').targets.build.executor
      ).toBe(expected);
      expect(tree.exists('lib1/ng-package.json')).toBe(false);
    }
  );

  it("should export ng-packagr's default entry file", async () => {
    addLibrary({
      executor: '@nx/angular:package',
      options: { project: 'lib1/ng-package.json' },
    });
    writeJson(tree, 'lib1/ng-package.json', { dest: '../dist/lib1' });
    tree.write('lib1/src/public_api.ts', '');
    tree.write('lib1/src/public-api.ts', '');

    await convertToLibraryExecutor(tree, {});

    expect(readJson(tree, 'lib1/package.json').exports).toStrictEqual({
      '.': './src/public_api.ts',
    });
  });

  // `getProjects` lists the projects in the order they're added, so the
  // generator converts them in that order.
  it.each(['lib1', 'nested'])(
    'should export a nested library and remove its configuration when both libraries convert, %s first',
    async (first) => {
      addNestedLibraries(first === 'nested');

      await convertToLibraryExecutor(tree, {});

      expect(readJson(tree, 'lib1/package.json').exports).toStrictEqual({
        '.': './src/index.ts',
        './nested': './nested/src/index.ts',
      });
      expect(tree.exists('lib1/nested/ng-package.json')).toBe(false);
    }
  );

  it('should only remove the configurations of the libraries a run converts', async () => {
    addLibrary({
      executor: '@nx/angular:package',
      options: { project: 'lib1/ng-package.json' },
    });
    writeJson(tree, 'lib1/button/ng-package.json', {
      lib: { entryFile: 'src/index.ts' },
    });
    tree.write('lib1/button/src/index.ts', '');
    addLibrary(
      {
        executor: '@nx/angular:package',
        options: { project: 'lib2/ng-package.json' },
      },
      'lib2'
    );
    await convertToLibraryExecutor(tree, { project: 'lib1' });

    await convertToLibraryExecutor(tree, { project: 'lib2' });

    expect(
      [
        'lib1/ng-package.json',
        'lib1/button/ng-package.json',
        'lib2/ng-package.json',
      ].filter((file) => tree.exists(file))
    ).toStrictEqual(['lib1/ng-package.json', 'lib1/button/ng-package.json']);
    expect(
      readJson(tree, 'package.json').devDependencies['ng-packagr']
    ).toBeUndefined();
  });

  it('should keep a secondary entry point configuration whose entry file is outside its directory', async () => {
    addLibrary({
      executor: '@nx/angular:package',
      options: { project: 'lib1/ng-package.json' },
    });
    writeJson(tree, 'lib1/button/ng-package.json', {
      lib: { entryFile: 'src/index.ts' },
    });
    tree.write('lib1/button/src/index.ts', '');
    writeJson(tree, 'lib1/testing/ng-package.json', {
      lib: { entryFile: '../src/testing.ts' },
    });
    tree.write('lib1/src/testing.ts', '');

    await convertToLibraryExecutor(tree, {});

    expect(readJson(tree, 'lib1/package.json').exports).toStrictEqual({
      '.': './src/index.ts',
      './button': './button/src/index.ts',
      './testing': './src/testing.ts',
    });
    expect(
      [
        'lib1/ng-package.json',
        'lib1/button/ng-package.json',
        'lib1/testing/ng-package.json',
      ].filter((file) => tree.exists(file))
    ).toStrictEqual(['lib1/testing/ng-package.json']);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '  - lib1/testing/ng-package.json ("./testing": "./src/testing.ts")'
      )
    );
  });

  it('should not convert a library with a secondary entry point reached through a symbolic link', async () => {
    const tempFs = new TempFs('convert-to-library-executor');
    try {
      tree.root = tempFs.tempDir;
      tempFs.createFileSync(
        'unrelated/ng-package.json',
        JSON.stringify({ lib: { entryFile: 'src/index.ts' } })
      );
      tempFs.createFileSync('unrelated/src/index.ts', '');
      tempFs.createFileSync('lib1/src/index.ts', '');
      symlinkSync(
        join(tempFs.tempDir, 'unrelated'),
        join(tempFs.tempDir, 'lib1/vendor'),
        'junction'
      );
      addLibrary({
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      });

      await convertToLibraryExecutor(tree, {});

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'The secondary entry point directory "lib1/vendor" is a symbolic link or is inside one'
        )
      );
      expect(
        readProjectConfiguration(tree, 'lib1').targets.build.executor
      ).toBe('@nx/angular:package');
      expect(tree.exists('lib1/vendor/ng-package.json')).toBe(true);
    } finally {
      tempFs.cleanup();
    }
  });

  it('should resolve an absolute entry file like ng-packagr', async () => {
    addLibrary({
      executor: '@nx/angular:package',
      options: { project: 'lib1/ng-package.json' },
    });
    writeJson(tree, 'lib1/ng-package.json', {
      dest: '../dist/lib1',
      lib: { entryFile: `${tree.root}/lib1/src/index.ts` },
    });

    await convertToLibraryExecutor(tree, {});

    expect(readJson(tree, 'lib1/package.json').exports).toStrictEqual({
      '.': './src/index.ts',
    });
  });

  it('should keep absolute style include paths and resolve relative ones against their configuration', async () => {
    addLibrary({
      executor: '@nx/angular:package',
      options: { project: 'lib1/ng-package.json' },
    });
    writeJson(tree, 'lib1/ng-package.json', {
      dest: '../dist/lib1',
      lib: {
        entryFile: 'src/index.ts',
        styleIncludePaths: [`${tree.root}/shared/styles`],
      },
    });
    writeJson(tree, 'lib1/button/ng-package.json', {
      lib: {
        entryFile: 'src/index.ts',
        styleIncludePaths: ['styles', `${tree.root}/shared/button`],
      },
    });
    tree.write('lib1/button/src/index.ts', '');

    await convertToLibraryExecutor(tree, {});

    expect(
      readProjectConfiguration(tree, 'lib1').targets.build.options
        .stylePreprocessorOptions.includePaths
    ).toStrictEqual([
      `${tree.root}/shared/styles`,
      'lib1/button/styles',
      `${tree.root}/shared/button`,
    ]);
  });

  it('should not read the package.json and angular.json files Nx does not read', async () => {
    updateJson(tree, 'nx.json', (json) => {
      json.plugins = [
        { plugin: '@nx/angular/plugin', exclude: ['fixtures/**'] },
      ];
      return json;
    });
    addLibrary({
      executor: '@nx/angular:package',
      options: { project: 'lib1/ng-package.json' },
    });
    tree.write('fixtures/invalid/package.json', '{');
    tree.write('fixtures/invalid/angular.json', '{');

    await convertToLibraryExecutor(tree, { project: 'lib1', skipFormat: true });

    expect(readProjectConfiguration(tree, 'lib1').targets.build.executor).toBe(
      '@nx/angular:library'
    );
  });

  it('should move the ng-packagr configuration to the target options and package.json', async () => {
    addLibrary({
      executor: '@nx/angular:package',
      outputs: [
        '{workspaceRoot}/dist/{projectRoot}',
        '{workspaceRoot}/dist/docs/{projectRoot}',
      ],
      options: {
        project: 'lib1/ng-package.json',
        tsConfig: 'lib1/tsconfig.lib.json',
      },
    });
    writeJson(tree, 'lib1/ng-package.json', {
      dest: '../dist/lib1',
      lib: {
        entryFile: 'src/public-api.ts',
        styleIncludePaths: ['src/styles'],
        sass: { silenceDeprecations: ['import'] },
      },
      assets: [
        'CHANGELOG.md',
        'src/assets',
        '**/*.md',
        { input: 'src/i18n', glob: '*.json', output: 'i18n' },
      ],
      allowedNonPeerDependencies: ['lodash'],
      inlineStyleLanguage: 'scss',
      keepLifecycleScripts: true,
      deleteDestPath: false,
    });
    writeJson(tree, 'lib1/package.json', {
      name: '@proj/lib1',
      dependencies: { tslib: '^2.3.0' },
      exports: { './theming': { sass: './theming/_index.scss' } },
    });
    writeJson(tree, 'lib1/tsconfig.lib.json', {});
    tree.write('lib1/src/public-api.ts', '');
    tree.write('lib1/CHANGELOG.md', '');
    tree.write('lib1/src/assets/logo.svg', '');

    await convertToLibraryExecutor(tree, {});

    const { build } = readProjectConfiguration(tree, 'lib1').targets;
    expect(build.outputs).toStrictEqual([
      '{options.outputPath}',
      '{workspaceRoot}/dist/docs/{projectRoot}',
    ]);
    expect(build.options).toStrictEqual({
      tsConfig: 'lib1/tsconfig.lib.json',
      outputPath: 'dist/lib1',
      assets: [
        { glob: 'CHANGELOG.md', input: 'lib1', output: '.' },
        { glob: '**/*', input: 'lib1/src/assets', output: 'src/assets' },
        { glob: '**/*.md', input: 'lib1', output: '.' },
        { input: 'lib1/src/i18n', glob: '*.json', output: 'i18n' },
      ],
      stylePreprocessorOptions: {
        includePaths: ['lib1/src/styles'],
        sass: { silenceDeprecations: ['import'] },
      },
      allowedNonPeerDependencies: ['lodash'],
      inlineStyleLanguage: 'scss',
      keepLifecycleScripts: true,
      deleteOutputPath: false,
      compilationMode: 'full',
    });
    expect(readJson(tree, 'lib1/package.json')).toStrictEqual({
      name: '@proj/lib1',
      exports: {
        './theming': { sass: './theming/_index.scss' },
        '.': './src/public-api.ts',
      },
    });
  });

  it.each([
    {
      scenario: 'the production tsconfig sets partial',
      tsConfigs: {
        'tsconfig.lib.prod.json': {
          angularCompilerOptions: { compilationMode: 'partial' },
        },
      },
      production: {},
      development: { compilationMode: 'full' },
    },
    {
      scenario: 'no tsconfig sets a mode',
      tsConfigs: { 'tsconfig.lib.prod.json': {} },
      production: { compilationMode: 'full' },
      development: { compilationMode: 'full' },
    },
    {
      scenario: 'the production tsconfig sets partial in bazelOptions',
      tsConfigs: {
        'tsconfig.lib.prod.json': {
          bazelOptions: {
            angularCompilerOptions: { compilationMode: 'partial' },
          },
        },
      },
      production: {},
      development: { compilationMode: 'full' },
    },
    {
      scenario: 'the tsconfigs inherit partial',
      tsConfigs: {
        'tsconfig.json': {
          angularCompilerOptions: { compilationMode: 'partial' },
        },
        'tsconfig.lib.json': { extends: './tsconfig.json' },
        'tsconfig.lib.prod.json': { extends: './tsconfig.lib.json' },
      },
      production: {},
      development: {},
    },
    {
      scenario: 'the production tsconfig inherits partial from a package',
      tsConfigs: {
        'tsconfig.lib.prod.json': { extends: '@proj/tsconfig/partial.json' },
      },
      production: {},
      development: { compilationMode: 'full' },
    },
    {
      // The Angular compiler resolves a package entry as a module, which
      // finds no tsconfig.json in the package root.
      scenario: 'the production tsconfig extends a package root',
      tsConfigs: {
        'tsconfig.lib.prod.json': { extends: '@proj/tsconfig' },
      },
      production: { compilationMode: 'full' },
      development: { compilationMode: 'full' },
    },
    {
      scenario: 'target defaults set the mode for the library builder',
      tsConfigs: {
        'tsconfig.lib.prod.json': {
          angularCompilerOptions: { compilationMode: 'partial' },
        },
      },
      targetDefaults: { options: { compilationMode: 'full' } },
      options: { compilationMode: 'partial' },
      production: {},
      development: { compilationMode: 'full' },
    },
  ])(
    'should keep the compilation mode ng-packagr used for each configuration when $scenario',
    async ({
      tsConfigs,
      targetDefaults,
      options = {},
      production,
      development,
    }) => {
      const partialTsConfig = {
        angularCompilerOptions: { compilationMode: 'partial' },
      };
      writeJson(tree, 'node_modules/@proj/tsconfig/package.json', {
        name: '@proj/tsconfig',
      });
      writeJson(
        tree,
        'node_modules/@proj/tsconfig/tsconfig.json',
        partialTsConfig
      );
      writeJson(
        tree,
        'node_modules/@proj/tsconfig/partial.json',
        partialTsConfig
      );
      if (targetDefaults) {
        updateJson(tree, 'nx.json', (json) => {
          json.targetDefaults['@angular/build:library'] = targetDefaults;
          return json;
        });
      }
      addLibrary({
        executor: '@angular/build:ng-packagr',
        options: { project: 'lib1/ng-package.json' },
        configurations: {
          production: { tsConfig: 'lib1/tsconfig.lib.prod.json' },
          development: { tsConfig: 'lib1/tsconfig.lib.json' },
        },
      });
      writeJson(tree, 'lib1/tsconfig.lib.json', {});
      for (const [file, json] of Object.entries(tsConfigs)) {
        writeJson(tree, `lib1/${file}`, json);
      }

      await convertToLibraryExecutor(tree, {});

      const { build } = readProjectConfiguration(tree, 'lib1').targets;
      expect(build.options).toStrictEqual({
        tsConfig: 'lib1/tsconfig.lib.json',
        outputPath: 'dist/lib1',
        ...options,
      });
      expect(build.configurations).toStrictEqual({
        production: { tsConfig: 'lib1/tsconfig.lib.prod.json', ...production },
        development,
      });
    }
  );

  it.each(['@nx/angular:package', 'build'])(
    'should keep the target defaults the old executor ran with from the "%s" key',
    async (key) => {
      updateJson(tree, 'nx.json', (json) => {
        json.targetDefaults[key] = {
          cache: true,
          dependsOn: ['^build', 'generate-api'],
          inputs: ['default', '^default'],
          options: { project: '{projectRoot}/ng-package.json' },
          configurations: {
            production: { tsConfig: '{projectRoot}/tsconfig.lib.prod.json' },
            development: { tsConfig: '{projectRoot}/tsconfig.lib.json' },
          },
          defaultConfiguration: 'production',
        };
        return json;
      });
      addLibrary({ executor: '@nx/angular:package' });
      writeJson(tree, 'lib1/tsconfig.lib.json', {});
      writeJson(tree, 'lib1/tsconfig.lib.prod.json', {
        angularCompilerOptions: { compilationMode: 'partial' },
      });

      await convertToLibraryExecutor(tree, {});

      expect(
        readProjectConfiguration(tree, 'lib1').targets.build
      ).toStrictEqual({
        executor: '@nx/angular:library',
        dependsOn: ['^build', 'generate-api'],
        defaultConfiguration: 'production',
        options: {
          tsConfig: '{projectRoot}/tsconfig.lib.json',
          outputPath: 'dist/lib1',
        },
        configurations: {
          production: { tsConfig: '{projectRoot}/tsconfig.lib.prod.json' },
          development: { compilationMode: 'full' },
        },
      });
    }
  );

  it.each([
    {
      scenario: 'its ng-packagr configuration is a JavaScript file',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.js' },
      },
      setup: () => tree.write('lib1/ng-package.js', 'module.exports = {};'),
      warning: 'JavaScript ng-packagr configuration files',
    },
    {
      scenario: 'its ng-packagr project directory has no configuration',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/src' },
      },
      warning: 'has no ng-package.json or ng-package.js file',
    },
    {
      scenario: 'its ng-packagr configuration is not in the project root',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/src/ng-package.json' },
      },
      setup: () => writeJson(tree, 'lib1/src/ng-package.json', {}),
      warning: 'is not in the project root',
    },
    {
      scenario: 'its configurations use different ng-packagr configurations',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
        configurations: {
          production: { project: 'lib1/ng-package.prod.json' },
        },
      },
      setup: () => writeJson(tree, 'lib1/ng-package.prod.json', {}),
      warning: 'use different ng-packagr configurations',
    },
    {
      scenario: 'it has no ng-package.json',
      target: { executor: '@nx/angular:package' },
      setup: () => {
        tree.delete('lib1/ng-package.json');
        writeJson(tree, 'lib1/package.json', {
          name: '@proj/lib1',
          ngPackage: { lib: { entryFile: 'src/index.ts' } },
        });
      },
      warning:
        'The ng-packagr configuration "lib1/ng-package.json" doesn\'t exist',
    },
    {
      scenario: 'its ng-packagr configuration is a package.json',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/package.json' },
      },
      warning: 'ng-packagr doesn\'t support "lib1/package.json"',
    },
    {
      scenario: 'another target gets ng-packagr from target defaults',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => {
        updateJson(tree, 'nx.json', (json) => {
          json.targetDefaults.legacy = { executor: '@nx/angular:package' };
          return json;
        });
        updateJson(tree, 'lib1/project.json', (json) => {
          json.targets.legacy = {};
          return json;
        });
      },
      warning: 'The "legacy" target also uses ng-packagr',
    },
    {
      scenario: 'its entry file is outside the project root',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => {
        writeJson(tree, 'lib1/ng-package.json', {
          dest: '../dist/lib1',
          lib: { entryFile: '../shared/public_api.ts' },
        });
        tree.write('shared/public_api.ts', '');
      },
      warning:
        'The entry file "shared/public_api.ts" is outside the project root "lib1"',
    },
    {
      scenario: "ng-packagr's default entry file is missing",
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => writeJson(tree, 'lib1/ng-package.json', {}),
      warning: 'The entry file "lib1/src/public_api.ts" doesn\'t exist',
    },
    {
      scenario: 'an angular.json file also builds it with ng-packagr',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => {
        registerAngularPlugin();
        writeJson(tree, 'lib1/angular.json', {
          version: 1,
          projects: {
            lib1: {
              root: '',
              projectType: 'library',
              architect: {
                build: { builder: '@angular/build:ng-packagr' },
              },
            },
          },
        });
      },
      warning: 'The "build" target in "lib1/angular.json" also uses ng-packagr',
    },
    {
      scenario:
        'target defaults set the project option for the library builder',
      target: { executor: '@angular/build:ng-packagr' },
      setup: () =>
        updateJson(tree, 'nx.json', (json) => {
          json.targetDefaults.build = {
            options: { project: '{projectRoot}/ng-package.json' },
          };
          return json;
        }),
      warning: 'Target defaults set the "project" option',
    },
    {
      scenario: 'its ng-packagr "dest" is absolute',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () =>
        writeJson(tree, 'lib1/ng-package.json', {
          dest: `${tree.root}/dist/lib1`,
          lib: { entryFile: 'src/index.ts' },
        }),
      warning: '/dist/lib1" is absolute',
    },
    {
      scenario: 'a secondary entry point configuration sets "dest"',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => {
        writeJson(tree, 'lib1/button/ng-package.json', {
          dest: 'dist',
          lib: { entryFile: 'src/index.ts' },
        });
        tree.write('lib1/button/src/index.ts', '');
      },
      warning:
        'ng-packagr rejects the "dest" option in the secondary entry point configuration "lib1/button/ng-package.json"',
    },
    {
      scenario: 'a secondary entry file is not TypeScript',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => {
        writeJson(tree, 'lib1/button/ng-package.json', {
          lib: { entryFile: 'src/index.tsx' },
        });
        tree.write('lib1/button/src/index.tsx', '');
      },
      warning: 'the "./button" entry point uses "./button/src/index.tsx"',
    },
    {
      scenario: 'its package.json has no name',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => writeJson(tree, 'lib1/package.json', { version: '0.0.1' }),
      warning: 'The library builder requires a "name" in "lib1/package.json"',
    },
    {
      scenario: 'a package.json export is outside the project root',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () =>
        writeJson(tree, 'lib1/package.json', {
          name: '@proj/lib1',
          exports: { './shared': '../shared/index.ts' },
        }),
      warning:
        'rejects the "./shared" export, because "../shared/index.ts" is outside the project root "lib1"',
    },
    {
      scenario: 'two entry points produce the same bundle',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => {
        writeJson(tree, 'lib1/package.json', {
          name: '@proj/lib1',
          exports: { './Button': './src/button.ts' },
        });
        writeJson(tree, 'lib1/button/ng-package.json', {
          lib: { entryFile: 'src/index.ts' },
        });
        tree.write('lib1/button/src/index.ts', '');
      },
      warning:
        'rejects the "./Button" and "./button" exports, because both produce the "proj-lib1-button" bundle',
    },
    {
      scenario: 'no tsConfig option is set',
      target: {
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      },
      setup: () => tree.delete('lib1/tsconfig.lib.json'),
      warning: 'requires the "tsConfig" option',
    },
    {
      scenario: 'its tsconfig extends a package that is not installed',
      target: {
        executor: '@nx/angular:package',
        options: {
          project: 'lib1/ng-package.json',
          tsConfig: 'lib1/tsconfig.lib.json',
        },
      },
      setup: () =>
        writeJson(tree, 'lib1/tsconfig.lib.json', {
          extends: '@proj/missing/tsconfig.json',
        }),
      warning: 'Could not resolve "@proj/missing/tsconfig.json"',
    },
  ])(
    'should not convert a library when $scenario',
    async ({ target, setup, warning }) => {
      addLibrary(target);
      setup?.();
      const rootPackageJson = readJson(tree, 'package.json');
      const libraryFiles = ['lib1/ng-package.json', 'lib1/package.json'];
      const libraryFileContents = libraryFiles.map((file) =>
        tree.read(file, 'utf-8')
      );

      await convertToLibraryExecutor(tree, { project: 'lib1' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(warning)
      );
      expect(
        readProjectConfiguration(tree, 'lib1').targets.build
      ).toStrictEqual(target);
      expect(
        libraryFiles.map((file) => tree.read(file, 'utf-8'))
      ).toStrictEqual(libraryFileContents);
      expect(readJson(tree, 'package.json')).toStrictEqual(rootPackageJson);
    }
  );

  it.each`
    scenario                                    | otherExecutor                    | warning
    ${'it has more than one ng-packagr target'} | ${'@nx/angular:ng-packagr-lite'} | ${'more than one target using ng-packagr'}
    ${'it already uses the library builder'}    | ${'@nx/angular:library'}         | ${'already using the library builder'}
  `(
    'should not convert a library when $scenario',
    async ({ otherExecutor, warning }) => {
      addLibrary({
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      });
      updateJson(tree, 'lib1/project.json', (json) => {
        json.targets['build-other'] = { executor: otherExecutor };
        return json;
      });

      await convertToLibraryExecutor(tree, { project: 'lib1' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(warning)
      );
      expect(
        readProjectConfiguration(tree, 'lib1').targets.build.executor
      ).toBe('@nx/angular:package');
    }
  );

  it.each([
    {
      declaration: 'a project.json',
      addOtherLibrary: () =>
        addLibrary(
          {
            executor: '@nx/angular:package',
            options: { project: 'lib2/ng-package.json' },
          },
          'lib2'
        ),
    },
    {
      declaration: 'a nested angular.json',
      addOtherLibrary: () => {
        registerAngularPlugin();
        writeJson(tree, 'apps/package.json', { name: 'apps' });
        writeJson(tree, 'apps/angular.json', {
          version: 1,
          projects: {
            lib2: {
              root: 'lib2',
              projectType: 'library',
              architect: {
                build: {
                  builder: '@angular/build:ng-packagr',
                  options: { project: 'lib2/ng-package.json' },
                },
              },
            },
          },
        });
      },
    },
  ])(
    'should keep ng-packagr and the converted configurations while $declaration still builds another project with it',
    async ({ addOtherLibrary }) => {
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies['ng-packagr'] = '~22.2.0';
        return json;
      });
      addLibrary({
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      });
      writeJson(tree, 'lib1/button/ng-package.json', {
        lib: { entryFile: 'src/index.ts' },
      });
      tree.write('lib1/button/src/index.ts', '');
      addOtherLibrary();

      await convertToLibraryExecutor(tree, { project: 'lib1' });

      expect(readJson(tree, 'package.json').devDependencies['ng-packagr']).toBe(
        '~22.2.0'
      );
      expect(
        readProjectConfiguration(tree, 'lib1').targets.build.executor
      ).toBe('@nx/angular:library');
      expect(tree.exists('lib1/ng-package.json')).toBe(true);
      expect(tree.exists('lib1/button/ng-package.json')).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          '  - lib1/ng-package.json\n  - lib1/button/ng-package.json'
        )
      );
    }
  );

  it('should add less when the library has less stylesheets', async () => {
    addLibrary({
      executor: '@nx/angular:package',
      options: { project: 'lib1/ng-package.json' },
    });
    tree.write('lib1/src/lib/button.component.less', '');

    await convertToLibraryExecutor(tree, {});

    expect(
      readJson(tree, 'package.json').devDependencies['less']
    ).toBeDefined();
  });

  it.each`
    core         | build
    ${'~22.2.0'} | ${'~22.3.0'}
    ${'~22.3.0'} | ${'~22.2.0'}
  `(
    'should throw when @angular/core is $core and @angular/build is $build',
    async ({ core, build }) => {
      setAngularVersions({ core, build });
      addLibrary({
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      });

      await expect(convertToLibraryExecutor(tree, {})).rejects.toThrow(
        /requires version 22.3.0 or later/
      );
    }
  );

  function setAngularVersions(versions: { core: string; build: string }) {
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = {
        ...json.dependencies,
        '@angular/core': versions.core,
      };
      json.devDependencies = {
        ...json.devDependencies,
        '@angular/build': versions.build,
      };
      return json;
    });
  }

  function addLibrary(target: TargetConfiguration, name = 'lib1', root = name) {
    addProjectConfiguration(tree, name, {
      root,
      sourceRoot: `${root}/src`,
      projectType: 'library',
      targets: { build: target },
    });
    writeJson(tree, `${root}/ng-package.json`, {
      dest: `../dist/${name}`,
      lib: { entryFile: 'src/index.ts' },
    });
    writeJson(tree, `${root}/package.json`, { name: `@proj/${name}` });
    writeJson(tree, `${root}/tsconfig.lib.json`, {});
    tree.write(`${root}/src/index.ts`, '');
  }

  // ng-packagr builds the nested library as a secondary entry point of lib1.
  function addNestedLibraries(nestedFirst = false) {
    const addLib1 = () =>
      addLibrary({
        executor: '@nx/angular:package',
        options: { project: 'lib1/ng-package.json' },
      });
    if (!nestedFirst) {
      addLib1();
    }
    addLibrary(
      {
        executor: '@nx/angular:package',
        options: { project: 'lib1/nested/ng-package.json' },
      },
      'nested',
      'lib1/nested'
    );
    if (nestedFirst) {
      addLib1();
    }
    // A secondary entry point configuration can't set `dest`.
    writeJson(tree, 'lib1/nested/ng-package.json', {
      lib: { entryFile: 'src/index.ts' },
    });
  }

  function registerAngularPlugin() {
    updateJson(tree, 'nx.json', (json) => {
      json.plugins = ['@nx/angular/plugin'];
      return json;
    });
  }
});
