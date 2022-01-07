import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { jestProjectGenerator } from './jest-project';
import { JestProjectSchema } from './schema.d';
import { jestConfigObject } from '../../utils/config/functions';

describe('jestProject', () => {
  let tree: Tree;
  let defaultOptions: Omit<JestProjectSchema, 'project'> = {
    supportTsx: false,
    skipSetupFile: false,
    skipSerializers: false,
    testEnvironment: 'jsdom',
    setupFile: 'none',
    skipFormat: false,
    compiler: 'tsc',
  };

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      targets: {
        lint: {
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: [],
          },
        },
      },
    });
    writeJson(tree, 'libs/lib1/tsconfig.json', {
      files: [],
      include: [],
      references: [],
    });
  });

  it('should generate files', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      setupFile: 'angular',
    } as JestProjectSchema);
    expect(tree.exists('libs/lib1/src/test-setup.ts')).toBeTruthy();
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(tree.exists('libs/lib1/tsconfig.spec.json')).toBeTruthy();
  });

  it('should generate files w/babel-jest', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      babelJest: true,
    } as JestProjectSchema);
    expect(tree.exists('babel.config.json')).toBeTruthy();
  });

  it('should alter workspace.json', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      setupFile: 'angular',
    } as JestProjectSchema);
    const lib1 = readProjectConfiguration(tree, 'lib1');
    expect(lib1.targets.test).toEqual({
      executor: '@nrwl/jest:jest',
      outputs: ['coverage/libs/lib1'],
      options: {
        jestConfig: 'libs/lib1/jest.config.js',
        passWithNoTests: true,
      },
    });
    expect(lib1.targets.lint.options.tsConfig).toContain(
      'libs/lib1/tsconfig.spec.json'
    );
  });

  it('should create a jest.config.js', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
    } as JestProjectSchema);
    expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should add a reference to solution tsconfig.json', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
    } as JestProjectSchema);
    const tsConfig = readJson(tree, 'libs/lib1/tsconfig.json');
    expect(tsConfig.references).toContainEqual({
      path: './tsconfig.spec.json',
    });
  });

  it('should create a tsconfig.spec.json', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      setupFile: 'angular',
    } as JestProjectSchema);
    const tsConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
    expect(tsConfig).toEqual({
      extends: './tsconfig.json',
      compilerOptions: {
        module: 'commonjs',
        outDir: '../../dist/out-tsc',
        types: ['jest', 'node'],
      },
      files: ['src/test-setup.ts'],
      include: ['**/*.test.ts', '**/*.spec.ts', '**/*.d.ts'],
    });
  });

  describe('--setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
      } as JestProjectSchema);
      expect(tree.exists('src/test-setup.ts')).toBeFalsy();
      expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).not.toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
    });

    it('should have setupFilesAfterEnv in the jest.config when generated for web-components', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'web-components',
      } as JestProjectSchema);
      expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
    });

    it('should have setupFilesAfterEnv and globals.ts-jest in the jest.config when generated for angular', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'angular',
      } as JestProjectSchema);

      const jestConfig = tree.read('libs/lib1/jest.config.js', 'utf-8');
      expect(jestConfig).toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
      expect(jestConfig).toMatchSnapshot();
    });

    it('should not list the setup file in workspace.json', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'none',
      } as JestProjectSchema);
      const lib1 = readProjectConfiguration(tree, 'lib1');
      expect(lib1.targets.test.options.setupFile).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'none',
      } as JestProjectSchema);
      const tsConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSetupFile: true,
      } as JestProjectSchema);
      expect(tree.exists('src/test-setup.ts')).toBeFalsy();
    });

    it('should not list the setup file in workspace.json', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSetupFile: true,
      } as JestProjectSchema);
      const lib1 = readProjectConfiguration(tree, 'lib1');
      expect(lib1.targets.test.options.setupFile).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSetupFile: true,
      } as JestProjectSchema);
      const tsConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-serializers', () => {
    it('should not list the serializers in jest.config.js', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSerializers: true,
      } as JestProjectSchema);
      const jestConfig = tree.read('libs/lib1/jest.config.js', 'utf-8');
      expect(jestConfig).not.toContain(`
      snapshotSerializers: [
        'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js,
        'jest-preset-angular/build/AngularSnapshotSerializer.js',
        'jest-preset-angular/build/HTMLCommentSerializer.js'
      ]
    `);
    });
  });

  describe('--support-tsx', () => {
    it('should add jest.transform', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        supportTsx: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.js');
      expect(jestConfig.transform).toEqual({
        '^.+\\.[tj]sx?$': 'ts-jest',
      });
    });

    it('should add tsx to moduleExtensions', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        supportTsx: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.js');
      expect(jestConfig.moduleFileExtensions).toEqual([
        'ts',
        'tsx',
        'js',
        'jsx',
      ]);
    });
  });

  describe('--babelJest', () => {
    it('should have globals.ts-jest configured when babelJest is false', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        babelJest: false,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.js');

      expect(jestConfig.globals).toEqual({
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json',
        },
      });
    });

    it('should generate proper jest.transform when babelJest is true', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        babelJest: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.js');

      expect(jestConfig.globals).not.toEqual({
        'ts-jest': {
          tsConfig: '<rootDir>/tsconfig.spec.json',
        },
      });
      expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toMatchSnapshot();
    });

    it('should generate proper jest.transform when babelJest and supportTsx is true', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        babelJest: true,
        supportTsx: true,
      } as JestProjectSchema);
      expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toMatchSnapshot();
    });

    // it('should generate proper jest.transform when --compiler=swc and supportTsx is true', async () => {
    //   await jestProjectGenerator(tree, {
    //     ...defaultOptions,
    //     project: 'lib1',
    //     compiler: 'swc',
    //     supportTsx: true,
    //   } as JestProjectSchema);
    //   expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toMatchSnapshot();
    // });
  });
});
