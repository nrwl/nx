import 'nx/src/internal-testing-utils/mock-fs';

import {
  getUpdatedPackageJsonContent,
  updatePackageJson,
  UpdatePackageJsonOption,
} from './update-package-json';
import { vol } from 'memfs';
import {
  DependencyType,
  ExecutorContext,
  ProjectGraph,
  readProjectsConfigurationFromProjectGraph,
} from '@nx/devkit';
import { DependentBuildableProjectNode } from '../buildable-libs-utils';

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('getUpdatedPackageJsonContent', () => {
  it('should update fields for commonjs only (default)', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
      }
    );

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      type: 'commonjs',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should update fields for esm only', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        format: ['esm'],
      }
    );

    expect(json).toEqual({
      name: 'test',
      type: 'module',
      module: './src/index.js',
      main: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should update fields for commonjs + esm', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        format: ['esm', 'cjs'],
      }
    );

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      module: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
    });
  });

  it('should support skipping types', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        skipTypings: true,
      }
    );

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      type: 'commonjs',
      version: '0.0.1',
    });
  });

  it('should not set types when { skipTypings: true }', () => {
    const json = getUpdatedPackageJsonContent(
      {
        name: 'test',
        version: '0.0.1',
      },
      {
        main: 'proj/src/index.ts',
        outputPath: 'dist/proj',
        projectRoot: 'proj',
        skipTypings: true,
      }
    );

    expect(json).toEqual({
      name: 'test',
      main: './src/index.js',
      type: 'commonjs',
      version: '0.0.1',
    });
  });

  describe('generateExportsField: true', () => {
    it('should add ESM exports', () => {
      const json = getUpdatedPackageJsonContent(
        {
          name: 'test',
          version: '0.0.1',
        },
        {
          main: 'proj/src/index.ts',
          outputPath: 'dist/proj',
          projectRoot: 'proj',
          format: ['esm'],
          generateExportsField: true,
        }
      );

      expect(json).toEqual({
        name: 'test',
        type: 'module',
        main: './src/index.js',
        module: './src/index.js',
        types: './src/index.d.ts',
        version: '0.0.1',
        exports: {
          '.': './src/index.js',
          './package.json': './package.json',
        },
      });
    });

    it('should add CJS exports', () => {
      const json = getUpdatedPackageJsonContent(
        {
          name: 'test',
          version: '0.0.1',
        },
        {
          main: 'proj/src/index.ts',
          outputPath: 'dist/proj',
          projectRoot: 'proj',
          format: ['cjs'],
          outputFileExtensionForCjs: '.cjs',
          generateExportsField: true,
        }
      );

      expect(json).toEqual({
        name: 'test',
        main: './src/index.cjs',
        types: './src/index.d.ts',
        version: '0.0.1',
        type: 'commonjs',
        exports: {
          '.': './src/index.cjs',
          './package.json': './package.json',
        },
      });
    });

    it('should add additional entry-points into package.json', () => {
      // CJS only
      expect(
        getUpdatedPackageJsonContent(
          {
            name: 'test',
            version: '0.0.1',
          },
          {
            main: 'proj/src/index.ts',
            additionalEntryPoints: [
              'proj/src/foo.ts',
              'proj/src/bar.ts',
              'proj/migrations.json',
              'proj/feature/index.ts',
            ],
            outputPath: 'dist/proj',
            projectRoot: 'proj',
            format: ['cjs'],
            generateExportsField: true,
          }
        )
      ).toEqual({
        name: 'test',
        main: './src/index.js',
        type: 'commonjs',
        types: './src/index.d.ts',
        version: '0.0.1',
        exports: {
          '.': './src/index.js',
          './foo': './src/foo.js',
          './bar': './src/bar.js',
          './package.json': './package.json',
          './migrations.json': './migrations.json',
          './feature': './feature/index.js',
          './feature/index': './feature/index.js',
        },
      });

      // ESM only
      expect(
        getUpdatedPackageJsonContent(
          {
            name: 'test',
            version: '0.0.1',
          },
          {
            main: 'proj/src/index.ts',
            additionalEntryPoints: [
              'proj/src/foo.ts',
              'proj/src/bar.ts',
              'proj/feature/index.ts',
            ],
            outputPath: 'dist/proj',
            projectRoot: 'proj',
            format: ['esm'],
            generateExportsField: true,
          }
        )
      ).toEqual({
        name: 'test',
        type: 'module',
        main: './src/index.js',
        module: './src/index.js',
        types: './src/index.d.ts',
        version: '0.0.1',
        exports: {
          '.': './src/index.js',
          './foo': './src/foo.js',
          './bar': './src/bar.js',
          './package.json': './package.json',
          './feature': './feature/index.js',
          './feature/index': './feature/index.js',
        },
      });

      // Dual format
      expect(
        getUpdatedPackageJsonContent(
          {
            name: 'test',
            version: '0.0.1',
          },
          {
            main: 'proj/src/index.ts',
            additionalEntryPoints: [
              'proj/src/foo.ts',
              'proj/src/bar.ts',
              'proj/feature/index.ts',
            ],
            outputPath: 'dist/proj',
            projectRoot: 'proj',
            format: ['cjs', 'esm'],
            outputFileExtensionForCjs: '.cjs',
            generateExportsField: true,
          }
        )
      ).toEqual({
        name: 'test',
        main: './src/index.cjs',
        module: './src/index.js',
        types: './src/index.d.ts',
        version: '0.0.1',
        exports: {
          '.': {
            import: './src/index.js',
            default: './src/index.cjs',
          },
          './foo': {
            import: './src/foo.js',
            default: './src/foo.cjs',
          },
          './bar': {
            import: './src/bar.js',
            default: './src/bar.cjs',
          },
          './feature': {
            import: './feature/index.js',
            default: './feature/index.cjs',
          },
          './feature/index': {
            import: './feature/index.js',
            default: './feature/index.cjs',
          },
          './package.json': './package.json',
        },
      });
    });
  });

  it('should support existing exports', () => {
    // Merge additional exports from user
    expect(
      getUpdatedPackageJsonContent(
        {
          name: 'test',
          version: '0.0.1',
          exports: {
            './custom': './custom.js',
          },
        },
        {
          main: 'proj/src/index.ts',
          outputPath: 'dist/proj',
          projectRoot: 'proj',
          format: ['esm', 'cjs'],
          outputFileExtensionForCjs: '.cjs',
          generateExportsField: true,
        }
      )
    ).toEqual({
      name: 'test',
      main: './src/index.cjs',
      module: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
      exports: {
        '.': {
          import: './src/index.js',
          default: './src/index.cjs',
        },
        './package.json': './package.json',
        './custom': './custom.js',
      },
    });
  });

  it('should no override existing type', () => {
    // Leave existing type untouched
    expect(
      getUpdatedPackageJsonContent(
        {
          name: 'test',
          version: '0.0.1',
          type: 'module',
        },
        {
          main: 'proj/src/index.ts',
          outputPath: 'dist/proj',
          projectRoot: 'proj',
          format: ['cjs'],
          outputFileExtensionForCjs: '.cjs',
          generateExportsField: true,
        }
      )
    ).toEqual({
      name: 'test',
      main: './src/index.cjs',
      types: './src/index.d.ts',
      version: '0.0.1',
      type: 'module',
      exports: {
        '.': './src/index.cjs',
        './package.json': './package.json',
      },
    });
  });
});

describe('updatePackageJson', () => {
  const originalPackageJson = {
    name: '@org/lib1',
    version: '0.0.3',
    dependencies: { lib2: '^0.0.1' },
    devDependencies: { jest: '27' },
  };
  const rootPackageJson = {
    name: '@org/root',
    version: '1.2.3',
    dependencies: { external1: '~1.0.0', external2: '^4.0.0' },
    devDependencies: { jest: '27' },
  };

  const fileMap = {
    '@org/lib1': [
      {
        file: 'libs/lib1/src/test.ts',
        hash: '',
        deps: ['npm:external1', 'npm:external2'],
      },
    ],
  };
  const projectGraph: ProjectGraph = {
    nodes: {
      '@org/lib1': {
        type: 'lib',
        name: '@org/lib1',
        data: {
          root: 'libs/lib1',
          targets: {
            build: {
              outputs: ['{workspaceRoot}/dist/libs/lib1'],
            },
          },
        },
      },
    },
    externalNodes: {
      'npm:external1': {
        type: 'npm',
        name: 'npm:external1',
        data: {
          packageName: 'external1',
          version: '1.0.0',
        },
      },
      'npm:external2': {
        type: 'npm',
        name: 'npm:external2',
        data: {
          packageName: 'external2',
          version: '4.5.6',
        },
      },
      'npm:jest': {
        type: 'npm',
        name: 'npm:jest',
        data: {
          packageName: 'jest',
          version: '21.1.0',
        },
      },
    },
    dependencies: {
      '@org/lib1': [
        {
          source: '@org/lib1',
          target: 'npm:external1',
          type: DependencyType.static,
        },
        {
          source: '@org/lib1',
          target: 'npm:external2',
          type: DependencyType.static,
        },
      ],
    },
  };
  const context: ExecutorContext = {
    root: '/root',
    projectName: '@org/lib1',
    isVerbose: false,
    cwd: '',
    targetName: 'build',
    projectGraph,
    projectsConfigurations:
      readProjectsConfigurationFromProjectGraph(projectGraph),
    nxJsonConfiguration: {},
  };

  it('should generate new package if missing', () => {
    const fsJson = {};
    vol.fromJSON(fsJson, '/root');
    const options: UpdatePackageJsonOption = {
      outputPath: 'dist/libs/lib1',
      projectRoot: 'libs/lib1',
      main: 'libs/lib1/main.ts',
    };
    const dependencies: DependentBuildableProjectNode[] = [];
    updatePackageJson(options, context, undefined, dependencies, fileMap);

    expect(vol.existsSync('dist/libs/lib1/package.json')).toEqual(true);
    const distPackageJson = JSON.parse(
      vol.readFileSync('dist/libs/lib1/package.json', 'utf-8').toString()
    );
    expect(distPackageJson).toMatchInlineSnapshot(`
      {
        "main": "./main.js",
        "name": "@org/lib1",
        "type": "commonjs",
        "types": "./main.d.ts",
        "version": "0.0.1",
      }
    `);
  });

  it('should keep package unchanged if "updateBuildableProjectDepsInPackageJson" not set', () => {
    const fsJson = {
      'libs/lib1/package.json': JSON.stringify(originalPackageJson, null, 2),
    };
    vol.fromJSON(fsJson, '/root');
    const options: UpdatePackageJsonOption = {
      outputPath: 'dist/libs/lib1',
      projectRoot: 'libs/lib1',
      main: 'libs/lib1/main.ts',
    };
    const dependencies: DependentBuildableProjectNode[] = [];
    updatePackageJson(options, context, undefined, dependencies);

    expect(vol.existsSync('dist/libs/lib1/package.json')).toEqual(true);
    const distPackageJson = JSON.parse(
      vol.readFileSync('dist/libs/lib1/package.json', 'utf-8').toString()
    );
    expect(distPackageJson.dependencies).toEqual(
      originalPackageJson.dependencies
    );
    expect(distPackageJson.main).toEqual('./main.js');
    expect(distPackageJson.types).toEqual('./main.d.ts');
  });

  it('should modify package if "updateBuildableProjectDepsInPackageJson" is set', () => {
    const fsJson = {
      'package.json': JSON.stringify(rootPackageJson, null, 2),
      'libs/lib1/package.json': JSON.stringify(originalPackageJson, null, 2),
    };
    vol.fromJSON(fsJson, '/root');
    const options: UpdatePackageJsonOption = {
      outputPath: 'dist/libs/lib1',
      projectRoot: 'libs/lib1',
      main: 'libs/lib1/main.ts',
      updateBuildableProjectDepsInPackageJson: true,
    };
    const dependencies: DependentBuildableProjectNode[] = [];
    updatePackageJson(options, context, undefined, dependencies, fileMap);

    expect(vol.existsSync('dist/libs/lib1/package.json')).toEqual(true);
    const distPackageJson = JSON.parse(
      vol.readFileSync('dist/libs/lib1/package.json', 'utf-8').toString()
    );
    expect(distPackageJson).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "external1": "~1.0.0",
          "external2": "^4.0.0",
          "lib2": "^0.0.1",
        },
        "main": "./main.js",
        "name": "@org/lib1",
        "type": "commonjs",
        "types": "./main.d.ts",
        "version": "0.0.3",
      }
    `);
  });
});
