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
import { writePrunedPnpmInstallSettings } from 'nx/src/utils/package-json';

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

jest.mock('nx/src/plugins/js/lock-file/lock-file', () => ({
  ...jest.requireActual('nx/src/plugins/js/lock-file/lock-file'),
  createLockFile: jest.fn(() => 'lock-file-content'),
}));

jest.mock('nx/src/utils/package-json', () => ({
  ...jest.requireActual('nx/src/utils/package-json'),
  writePrunedPnpmInstallSettings: jest.fn(),
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
          developmentConditionName: '@my-org/source',
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
          '.': {
            '@my-org/source': './src/index.ts',
            default: './src/index.js',
            import: './src/index.js',
            types: './src/index.d.ts',
          },
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
          developmentConditionName: '@my-org/source',
        }
      );

      expect(json).toEqual({
        name: 'test',
        main: './src/index.cjs',
        types: './src/index.d.ts',
        version: '0.0.1',
        type: 'commonjs',
        exports: {
          '.': {
            '@my-org/source': './src/index.ts',
            default: './src/index.cjs',
            types: './src/index.d.ts',
          },
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
            developmentConditionName: '@my-org/source',
          }
        )
      ).toEqual({
        name: 'test',
        main: './src/index.js',
        type: 'commonjs',
        types: './src/index.d.ts',
        version: '0.0.1',
        exports: {
          '.': {
            '@my-org/source': './src/index.ts',
            default: './src/index.js',
            types: './src/index.d.ts',
          },
          './foo': {
            '@my-org/source': './src/foo.ts',
            default: './src/foo.js',
          },
          './bar': {
            '@my-org/source': './src/bar.ts',
            default: './src/bar.js',
          },
          './package.json': './package.json',
          './migrations.json': './migrations.json',
          './feature': {
            '@my-org/source': './feature/index.ts',
            default: './feature/index.js',
          },
          './feature/index': {
            '@my-org/source': './feature/index.ts',
            default: './feature/index.js',
          },
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
            developmentConditionName: '@my-org/source',
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
          '.': {
            '@my-org/source': './src/index.ts',
            default: './src/index.js',
            import: './src/index.js',
            types: './src/index.d.ts',
          },
          './foo': {
            '@my-org/source': './src/foo.ts',
            import: './src/foo.js',
            default: './src/foo.js',
          },
          './bar': {
            '@my-org/source': './src/bar.ts',
            import: './src/bar.js',
            default: './src/bar.js',
          },
          './package.json': './package.json',
          './feature': {
            '@my-org/source': './feature/index.ts',
            import: './feature/index.js',
            default: './feature/index.js',
          },
          './feature/index': {
            '@my-org/source': './feature/index.ts',
            import: './feature/index.js',
            default: './feature/index.js',
          },
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
            developmentConditionName: '@my-org/source',
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
            '@my-org/source': './src/index.ts',
            import: './src/index.js',
            default: './src/index.cjs',
            types: './src/index.d.ts',
          },
          './foo': {
            '@my-org/source': './src/foo.ts',
            import: './src/foo.js',
            default: './src/foo.cjs',
          },
          './bar': {
            '@my-org/source': './src/bar.ts',
            import: './src/bar.js',
            default: './src/bar.cjs',
          },
          './feature': {
            '@my-org/source': './feature/index.ts',
            import: './feature/index.js',
            default: './feature/index.cjs',
          },
          './feature/index': {
            '@my-org/source': './feature/index.ts',
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
          developmentConditionName: '@my-org/source',
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
          '@my-org/source': './src/index.ts',
          import: './src/index.js',
          default: './src/index.cjs',
          types: './src/index.d.ts',
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
          developmentConditionName: '@my-org/source',
        }
      )
    ).toEqual({
      name: 'test',
      main: './src/index.cjs',
      types: './src/index.d.ts',
      version: '0.0.1',
      type: 'module',
      exports: {
        '.': {
          '@my-org/source': './src/index.ts',
          default: './src/index.cjs',
          types: './src/index.d.ts',
        },
        './package.json': './package.json',
      },
    });
  });

  it('should handle outputFileName correctly', () => {
    expect(
      getUpdatedPackageJsonContent(
        {
          name: 'test',
          version: '0.0.1',
        },
        {
          main: 'proj/src/index.ts',
          outputPath: 'dist/proj',
          projectRoot: 'proj',
          format: ['cjs'],
          generateExportsField: true,
          outputFileName: 'src/index.js',
          developmentConditionName: '@my-org/source',
        }
      )
    ).toEqual({
      name: 'test',
      main: './src/index.js',
      types: './src/index.d.ts',
      version: '0.0.1',
      type: 'commonjs',
      exports: {
        '.': {
          '@my-org/source': './src/index.ts',
          default: './src/index.js',
          types: './src/index.d.ts',
        },
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

  it('should drop pnpm overrides from the manifest when a lockfile is generated', () => {
    const fsJson = {
      'package.json': JSON.stringify(
        { ...rootPackageJson, pnpm: { overrides: { external1: '1.0.0' } } },
        null,
        2
      ),
      'libs/lib1/package.json': JSON.stringify(originalPackageJson, null, 2),
    };
    vol.fromJSON(fsJson, '/root');
    const options: UpdatePackageJsonOption = {
      outputPath: 'dist/libs/lib1',
      projectRoot: 'libs/lib1',
      main: 'libs/lib1/main.ts',
      updateBuildableProjectDepsInPackageJson: true,
      generateLockfile: true,
    };
    updatePackageJson(options, context, undefined, [], fileMap);

    const distPackageJson = JSON.parse(
      vol.readFileSync('dist/libs/lib1/package.json', 'utf-8').toString()
    );
    // The accompanying pruned lockfile drops `overrides`, so the manifest must
    // too, or pnpm <=10 aborts with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
    expect(distPackageJson.pnpm).toBeUndefined();
  });

  it('should keep pnpm overrides in the manifest when no lockfile is generated', () => {
    const fsJson = {
      'package.json': JSON.stringify(
        { ...rootPackageJson, pnpm: { overrides: { external1: '1.0.0' } } },
        null,
        2
      ),
      'libs/lib1/package.json': JSON.stringify(originalPackageJson, null, 2),
    };
    vol.fromJSON(fsJson, '/root');
    const options: UpdatePackageJsonOption = {
      outputPath: 'dist/libs/lib1',
      projectRoot: 'libs/lib1',
      main: 'libs/lib1/main.ts',
      updateBuildableProjectDepsInPackageJson: true,
    };
    updatePackageJson(options, context, undefined, [], fileMap);

    const distPackageJson = JSON.parse(
      vol.readFileSync('dist/libs/lib1/package.json', 'utf-8').toString()
    );
    expect(distPackageJson.pnpm).toEqual({ overrides: { external1: '1.0.0' } });
  });

  it('should drop pnpm config from a verbatim manifest when a lockfile is generated', () => {
    const fsJson = {
      'package.json': JSON.stringify(rootPackageJson, null, 2),
      'libs/lib1/package.json': JSON.stringify(
        { ...originalPackageJson, pnpm: { overrides: { lib2: '0.0.1' } } },
        null,
        2
      ),
    };
    vol.fromJSON(fsJson, '/root');
    const options: UpdatePackageJsonOption = {
      outputPath: 'dist/libs/lib1',
      projectRoot: 'libs/lib1',
      main: 'libs/lib1/main.ts',
      // No updateBuildableProjectDepsInPackageJson: exercises the verbatim-manifest
      // branch, which strips pnpm config directly rather than via createPackageJson.
      generateLockfile: true,
    };
    updatePackageJson(options, context, undefined, [], fileMap);

    const distPackageJson = JSON.parse(
      vol.readFileSync('dist/libs/lib1/package.json', 'utf-8').toString()
    );
    // The accompanying pruned lockfile drops `overrides`, so the manifest must too.
    expect(distPackageJson.pnpm).toBeUndefined();
  });

  const mockWritePrunedPnpmInstallSettings =
    writePrunedPnpmInstallSettings as jest.MockedFunction<
      typeof writePrunedPnpmInstallSettings
    >;

  it('carries pnpm install settings beside the generated lockfile on pnpm', () => {
    mockWritePrunedPnpmInstallSettings.mockClear();
    // Reset so a lockfile written by another test does not skew detection.
    vol.reset();
    const fsJson = {
      'package.json': JSON.stringify(rootPackageJson, null, 2),
      // A pnpm-lock.yaml makes detectPackageManager report pnpm deterministically.
      'pnpm-lock.yaml': `lockfileVersion: '9.0'\n`,
      'libs/lib1/package.json': JSON.stringify(originalPackageJson, null, 2),
    };
    vol.fromJSON(fsJson, '/root');
    const options: UpdatePackageJsonOption = {
      outputPath: 'dist/libs/lib1',
      projectRoot: 'libs/lib1',
      main: 'libs/lib1/main.ts',
      updateBuildableProjectDepsInPackageJson: true,
      generateLockfile: true,
    };
    updatePackageJson(options, context, undefined, [], fileMap);

    // pnpm 11 reads build-script approvals only from pnpm-workspace.yaml, so the
    // executor must re-emit them into the output dir (context.root is the source).
    expect(mockWritePrunedPnpmInstallSettings).toHaveBeenCalledWith(
      'dist/libs/lib1',
      '/root'
    );
  });

  it('does not carry pnpm install settings for a non-pnpm package manager', () => {
    mockWritePrunedPnpmInstallSettings.mockClear();
    // Reset so a pnpm-lock.yaml written by another test does not skew detection.
    vol.reset();
    const fsJson = {
      'package.json': JSON.stringify(rootPackageJson, null, 2),
      'package-lock.json': JSON.stringify({ lockfileVersion: 3 }),
      'libs/lib1/package.json': JSON.stringify(originalPackageJson, null, 2),
    };
    vol.fromJSON(fsJson, '/root');
    const options: UpdatePackageJsonOption = {
      outputPath: 'dist/libs/lib1',
      projectRoot: 'libs/lib1',
      main: 'libs/lib1/main.ts',
      updateBuildableProjectDepsInPackageJson: true,
      generateLockfile: true,
    };
    updatePackageJson(options, context, undefined, [], fileMap);

    expect(mockWritePrunedPnpmInstallSettings).not.toHaveBeenCalled();
  });
});
