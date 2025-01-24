import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  writeJson,
  updateJson,
  readNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { jestConfigObject } from '../../utils/config/functions';

import configurationGenerator from './configuration';
import { JestProjectSchema } from './schema.d';

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
    addPlugin: true,
  };

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {},
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
    await configurationGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      setupFile: 'angular',
    } as JestProjectSchema);
    expect(tree.read('libs/lib1/src/test-setup.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

      setupZoneTestEnv();
      "
    `);
    expect(tree.exists('libs/lib1/jest.config.ts')).toBeTruthy();
    expect(tree.exists('libs/lib1/tsconfig.spec.json')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should add target if there are no targets', async () => {
    const pc = readProjectConfiguration(tree, 'lib1');
    delete pc.targets;
    updateProjectConfiguration(tree, 'lib1', pc);
    expect(async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'angular',
      });
    }).not.toThrow();
  });

  it('should create a jest.config.ts', async () => {
    await configurationGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
    } as JestProjectSchema);
    expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should add a reference to solution tsconfig.json', async () => {
    await configurationGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
    } as JestProjectSchema);
    const tsConfig = readJson(tree, 'libs/lib1/tsconfig.json');
    expect(tsConfig.references).toContainEqual({
      path: './tsconfig.spec.json',
    });
  });

  it('should create a tsconfig.spec.json', async () => {
    await configurationGenerator(tree, {
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
        target: 'es2016',
      },
      files: ['src/test-setup.ts'],
      include: [
        'jest.config.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
      ],
    });
  });

  describe('--setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
      } as JestProjectSchema);
      expect(tree.exists('src/test-setup.ts')).toBeFalsy();
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).not.toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
    });

    it('should have setupFilesAfterEnv in the jest.config when generated for web-components', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'web-components',
      } as JestProjectSchema);
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
    });

    it('should have setupFilesAfterEnv and globals.ts-jest in the jest.config when generated for angular', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'angular',
      } as JestProjectSchema);

      const jestConfig = tree.read('libs/lib1/jest.config.ts', 'utf-8');
      expect(jestConfig).toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
      expect(jestConfig).toMatchSnapshot();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      await configurationGenerator(tree, {
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
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSetupFile: true,
      } as JestProjectSchema);
      expect(tree.exists('src/test-setup.ts')).toBeFalsy();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSetupFile: true,
      } as JestProjectSchema);
      const tsConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-serializers', () => {
    it('should not list the serializers in jest.config.ts', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSerializers: true,
      } as JestProjectSchema);
      const jestConfig = tree.read('libs/lib1/jest.config.ts', 'utf-8');
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
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        supportTsx: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.ts');
      expect(jestConfig.transform).toEqual({
        '^.+\\.[tj]sx?$': [
          'ts-jest',
          { tsconfig: '<rootDir>/tsconfig.spec.json' },
        ],
      });
    });

    it('should add tsx to moduleExtensions', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        supportTsx: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.ts');
      expect(jestConfig.moduleFileExtensions).toEqual([
        'ts',
        'tsx',
        'js',
        'jsx',
      ]);
    });
  });

  it('should create jest.config.js with --js flag', async () => {
    await configurationGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('jest.preset.js')).toBeTruthy();
    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toContain(
      "preset: '../../jest.preset.js',"
    );
  });

  it('should use jest.config.js in project config with --js flag', async () => {
    await configurationGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
  });

  it('should generate a jest.preset.js when it does not exist', async () => {
    await configurationGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(tree.exists('jest.preset.js')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toContain(
      "preset: '../../jest.preset.js',"
    );
  });

  it('should not override existing jest preset file and should point to it in jest.config files', async () => {
    tree.write('jest.preset.mjs', 'export default {}');
    await configurationGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(tree.exists('jest.preset.mjs')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toContain(
      "preset: '../../jest.preset.mjs',"
    );
  });

  it('should use module.exports with --js flag', async () => {
    await configurationGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toContain(
      'module.exports = {'
    );
  });

  describe('--babelJest', () => {
    it('should generate proper jest.transform when babelJest is true', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        babelJest: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.ts');

      expect(jestConfig.globals).not.toEqual({
        'ts-jest': {
          tsConfig: '<rootDir>/tsconfig.spec.json',
        },
      });
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should generate proper jest.transform when babelJest and supportTsx is true', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        babelJest: true,
        supportTsx: true,
      } as JestProjectSchema);
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should generate proper jest.transform when --compiler=swc and supportTsx is true', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        compiler: 'swc',
        supportTsx: true,
      } as JestProjectSchema);

      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
      // assert the TS solution setup doesn't leak into the old/integrated setup
      expect(tree.exists('libs/lib1/.spec.swcrc')).toBeFalsy();
    });
  });

  describe('root project', () => {
    it('root jest.config.ts should be project config', async () => {
      writeJson(tree, 'tsconfig.json', {
        files: [],
        include: [],
        references: [],
      });
      addProjectConfiguration(tree, 'my-project', {
        root: '',
        sourceRoot: 'src',
        name: 'my-project',
        targets: {},
      });
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'my-project',
      });
      expect(tree.read('jest.config.ts', 'utf-8')).toMatchInlineSnapshot(`
        "export default {
          displayName: 'my-project',
          preset: './jest.preset.js',
          coverageDirectory: './coverage/my-project',
          testMatch: [
            '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
            '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)',
          ],
        };
        "
      `);
    });

    it('root jest.config.js should be project config', async () => {
      writeJson(tree, 'tsconfig.json', {
        files: [],
        include: [],
        references: [],
      });
      addProjectConfiguration(tree, 'my-project', {
        root: '',
        sourceRoot: 'src',
        name: 'my-project',
        targets: {},
      });
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'my-project',
        js: true,
      });
      expect(tree.read('jest.config.js', 'utf-8')).toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'my-project',
          preset: './jest.preset.js',
          coverageDirectory: './coverage/my-project',
          testMatch: [
            '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
            '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)',
          ],
        };
        "
      `);
    });
  });

  describe(`jest.preset.cjs`, () => {
    it(`root jest.preset.cjs existing should force subsequent configs to point to it correctly`, async () => {
      // ARRANGE
      tree.write(
        `jest.preset.cjs`,
        `
      const nxPreset = require('@nx/jest/preset').default;

      module.exports = { ...nxPreset }`
      );

      // ACT
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
      } as JestProjectSchema);

      // ASSERT
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "export default {
          displayName: 'lib1',
          preset: '../../jest.preset.cjs',
          coverageDirectory: '../../coverage/libs/lib1',
        };
        "
      `);
    });

    it(`root package.json type=module should create jest.preset.cjs and force subsequent configs to point to it correctly`, async () => {
      // ARRANGE
      updateJson(tree, 'package.json', (pkgJson) => {
        pkgJson.type = 'module';
        return pkgJson;
      });

      // ACT
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
      } as JestProjectSchema);

      // ASSERT
      expect(tree.exists('jest.preset.cjs')).toBeTruthy();
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "export default {
          displayName: 'lib1',
          preset: '../../jest.preset.cjs',
          coverageDirectory: '../../coverage/libs/lib1',
        };
        "
      `);
    });
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: { composite: true },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });

      addProjectConfiguration(tree, 'pkg1', {
        root: 'packages/pkg1',
        sourceRoot: 'packages/pkg1/src',
        targets: {
          lint: {
            executor: '@nx/eslint:lint',
            options: {},
          },
        },
      });
      writeJson(tree, 'packages/pkg1/tsconfig.json', {
        files: [],
        include: [],
        references: [],
      });
    });

    it('should generate files', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'pkg1',
      });

      expect(tree.exists('packages/pkg1/tsconfig.spec.json')).toBeTruthy();
      expect(tree.exists('packages/pkg1/jest.config.ts')).toBeTruthy();
      expect(tree.read('packages/pkg1/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "export default {
          displayName: 'pkg1',
          preset: '../../jest.preset.js',
          coverageDirectory: 'test-output/jest/coverage',
        };
        "
      `);
      expect(tree.exists('packages/pkg1/.spec.swcrc')).toBeFalsy();
    });

    it(`should setup a task pipeline for the test target to depend on the deps' build target`, async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'pkg1',
      });

      const nxJson = readNxJson(tree);
      expect(nxJson.targetDefaults.test.dependsOn).toStrictEqual(['^build']);
    });

    it('should generate files with swc compiler', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'pkg1',
        compiler: 'swc',
      });

      expect(tree.exists('packages/pkg1/tsconfig.spec.json')).toBeTruthy();
      expect(tree.exists('packages/pkg1/jest.config.ts')).toBeTruthy();
      expect(tree.read('packages/pkg1/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        import { readFileSync } from 'fs';

        // Reading the SWC compilation config for the spec files
        const swcJestConfig = JSON.parse(
          readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8')
        );

        // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
        swcJestConfig.swcrc = false;

        export default {
          displayName: 'pkg1',
          preset: '../../jest.preset.js',
          transform: {
            '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: 'test-output/jest/coverage',
        };
        "
      `);
      expect(tree.exists('packages/pkg1/.spec.swcrc')).toBeTruthy();
      expect(tree.read('packages/pkg1/.spec.swcrc', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "jsc": {
            "target": "es2017",
            "parser": {
              "syntax": "typescript",
              "decorators": true,
              "dynamicImport": true
            },
            "transform": {
              "decoratorMetadata": true,
              "legacyDecorator": true
            },
            "keepClassNames": true,
            "externalHelpers": true,
            "loose": true
          },
          "module": {
            "type": "es6"
          },
          "sourceMaps": true,
          "exclude": []
        }
        "
      `);
    });

    it('should generate the correct options for swc when "supportTsx: true"', async () => {
      await configurationGenerator(tree, {
        ...defaultOptions,
        project: 'pkg1',
        compiler: 'swc',
        supportTsx: true,
      });

      expect(tree.read('packages/pkg1/.spec.swcrc', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "jsc": {
            "target": "es2017",
            "parser": {
              "syntax": "typescript",
              "decorators": true,
              "dynamicImport": true,
              "tsx": true
            },
            "transform": {
              "decoratorMetadata": true,
              "legacyDecorator": true,
              "react": {
                "runtime": "automatic"
              }
            },
            "keepClassNames": true,
            "externalHelpers": true,
            "loose": true
          },
          "module": {
            "type": "es6"
          },
          "sourceMaps": true,
          "exclude": []
        }
        "
      `);
    });
  });
});
