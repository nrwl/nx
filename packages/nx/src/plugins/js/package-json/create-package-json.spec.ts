vi.mock('fs', async () => ({
  ...require('fs'),
  existsSync: vi.fn(),
}));
vi.mock('../../../utils/fileutils');

// Reading the real `@nx/devkit` package.json is a sandbox-violating
// cross-project read. The other stubbed packages are not installed, so
// `require` cannot read them. Packages without a stub read as missing.
const manifests = vi.hoisted(
  (): Record<
    string,
    Pick<PackageJson, 'peerDependencies' | 'peerDependenciesMeta'>
  > => ({ '@nx/devkit': { peerDependencies: { nx: '*' } } })
);
vi.mock('../../../utils/package-json', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/package-json')>()),
  readModulePackageJson: vi.fn((moduleSpecifier: string) => {
    if (!manifests[moduleSpecifier]) {
      throw new Error(`No package.json stub for ${moduleSpecifier}`);
    }
    return { packageJson: manifests[moduleSpecifier], path: '' };
  }),
}));

import * as fs from 'fs';
import * as configModule from '../../../config/configuration';
import {
  DependencyType,
  FileData,
  FileDataDependency,
  ProjectFileMap,
  ProjectGraph,
} from '../../../config/project-graph';
import * as hashModule from '../../../hasher/task-hasher';
import { createPackageJson } from './create-package-json';
import * as fileutilsModule from '../../../utils/fileutils';
import {
  type PackageJson,
  readModulePackageJson,
} from '../../../utils/package-json';

describe('createPackageJson', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it('should add additional dependencies', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
      dependencies: {
        typescript: '4.8.4',
        tslib: '2.4.0',
      },
    });

    expect(
      createPackageJson(
        'lib1',
        {
          nodes: {
            lib1: {
              type: 'lib',
              name: 'lib1',
              data: { targets: {}, root: '' },
            },
          },
          externalNodes: {
            'npm:tslib': {
              type: 'npm',
              name: 'npm:tslib',
              data: { version: '2.4.0', hash: '', packageName: 'tslib' },
            },
          },
          dependencies: {},
        },
        { helperDependencies: ['npm:tslib'], root: '' }
      )
    ).toEqual({
      dependencies: {
        tslib: '2.4.0',
      },
      name: 'lib1',
      version: '0.0.1',
    });
  });

  describe('when the helper dependency has no bare node', () => {
    const tslibNodes = {
      'npm:tslib@1.14.1': {
        type: 'npm' as const,
        name: 'npm:tslib@1.14.1' as const,
        data: { version: '1.14.1', hash: '', packageName: 'tslib' },
      },
      'npm:tslib@2.4.0': {
        type: 'npm' as const,
        name: 'npm:tslib@2.4.0' as const,
        data: { version: '2.4.0', hash: '', packageName: 'tslib' },
      },
    };

    beforeEach(() => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({});
    });

    it('should add the version that the project depends on', () => {
      expect(
        createPackageJson(
          'lib1',
          {
            nodes: {
              lib1: {
                type: 'lib',
                name: 'lib1',
                data: { targets: {}, root: '' },
              },
            },
            externalNodes: tslibNodes,
            dependencies: {
              lib1: [
                {
                  source: 'lib1',
                  target: 'npm:tslib@1.14.1',
                  type: DependencyType.static,
                },
              ],
            },
          },
          { helperDependencies: ['npm:tslib'], root: '' }
        ).dependencies
      ).toEqual({ tslib: '1.14.1' });
    });

    it('should add the highest version when the project does not depend on it', () => {
      expect(
        createPackageJson(
          'lib1',
          {
            nodes: {
              lib1: {
                type: 'lib',
                name: 'lib1',
                data: { targets: {}, root: '' },
              },
            },
            externalNodes: tslibNodes,
            dependencies: {},
          },
          { helperDependencies: ['npm:tslib'], root: '' }
        ).dependencies
      ).toEqual({ tslib: '2.4.0' });
    });

    it('should skip a bare outside link when registry versions exist', () => {
      const lib1 = {
        type: 'lib' as const,
        name: 'lib1',
        data: { targets: {}, root: '' },
      };
      const externalNodes = {
        ...tslibNodes,
        'npm:tslib': {
          type: 'npm' as const,
          name: 'npm:tslib' as const,
          data: {
            version: 'link:../outside/tslib',
            hash: '',
            packageName: 'tslib',
          },
        },
      };

      expect(
        createPackageJson(
          'lib1',
          {
            nodes: { lib1 },
            externalNodes,
            dependencies: {
              lib1: [
                {
                  source: 'lib1',
                  target: 'npm:tslib@1.14.1',
                  type: DependencyType.static,
                },
              ],
            },
          },
          { helperDependencies: ['npm:tslib'], root: '' }
        ).dependencies
      ).toEqual({ tslib: '1.14.1' });
      expect(
        createPackageJson(
          'lib1',
          { nodes: { lib1 }, externalNodes, dependencies: {} },
          { helperDependencies: ['npm:tslib'], root: '' }
        ).dependencies
      ).toEqual({ tslib: '2.4.0' });
    });
  });

  it('should only add file dependencies if target is specified', () => {
    vi.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
      namedInputs: {
        default: ['{projectRoot}/**/*'],
        production: ['!{projectRoot}/**/*.spec.ts'],
      },
      targetDefaults: {
        build: {
          inputs: ['default', 'production', '^production'],
        },
      },
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
      dependencies: {
        axios: '1.0.0',
        tslib: '2.4.0',
        jest: '29.0.0',
        typescript: '4.8.4',
      },
    });

    expect(
      createPackageJson(
        'lib1',
        {
          nodes: {
            lib1: {
              type: 'lib',
              name: 'lib1',
              data: {
                root: 'libs/lib1',
                targets: {
                  build: {},
                },
              },
            },
            lib2: {
              type: 'lib',
              name: 'lib2',
              data: {
                root: 'libs/lib2',
                targets: {
                  build: {},
                },
              },
            },
          },
          externalNodes: {
            'npm:tslib': {
              type: 'npm',
              name: 'npm:tslib',
              data: { version: '2.4.0', hash: '', packageName: 'tslib' },
            },
            'npm:typescript': {
              type: 'npm',
              name: 'npm:typescript',
              data: { version: '4.8.4', hash: '', packageName: 'typescript' },
            },
            'npm:jest': {
              type: 'npm',
              name: 'npm:jest',
              data: { version: '29.0.0', hash: '', packageName: 'jest' },
            },
            'npm:axios': {
              type: 'npm',
              name: 'npm:jest',
              data: { version: '1.0.0', hash: '', packageName: 'axios' },
            },
          },
          dependencies: {},
        },
        {
          target: 'build',
          isProduction: true,
          helperDependencies: ['npm:tslib'],
          root: '',
        }
      )
    ).toEqual({
      dependencies: {
        tslib: '2.4.0',
      },
      name: 'lib1',
      version: '0.0.1',
    });
  });

  it('should only add all dependencies if target is not specified', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
      dependencies: {
        axios: '1.0.0',
        tslib: '2.4.0',
        jest: '29.0.0',
        typescript: '4.8.4',
      },
    });

    expect(
      createPackageJson(
        'lib1',
        {
          nodes: {
            lib1: {
              type: 'lib',
              name: 'lib1',
              data: {
                root: 'libs/lib1',
                targets: {
                  build: {},
                },
              },
            },
            lib2: {
              type: 'lib',
              name: 'lib2',
              data: {
                root: 'libs/lib2',
                targets: {
                  build: {},
                },
              },
            },
          },
          externalNodes: {
            'npm:tslib': {
              type: 'npm',
              name: 'npm:tslib',
              data: { version: '2.4.0', hash: '', packageName: 'tslib' },
            },
            'npm:typescript': {
              type: 'npm',
              name: 'npm:typescript',
              data: { version: '4.8.4', hash: '', packageName: 'typescript' },
            },
            'npm:jest': {
              type: 'npm',
              name: 'npm:jest',
              data: { version: '29.0.0', hash: '', packageName: 'jest' },
            },
            'npm:axios': {
              type: 'npm',
              name: 'npm:axios',
              data: { version: '1.0.0', hash: '', packageName: 'axios' },
            },
          },
          dependencies: {},
        },
        { isProduction: true, helperDependencies: ['npm:tslib'], root: '' }
      )
    ).toEqual({
      dependencies: {
        tslib: '2.4.0',
      },
      name: 'lib1',
      version: '0.0.1',
    });
  });

  it('should cache filterUsingGlobPatterns', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
      dependencies: {
        axios: '1.0.0',
        tslib: '2.4.0',
        jest: '29.0.0',
        typescript: '4.8.4',
      },
    });
    const filterUsingGlobPatternsSpy = vi.spyOn(
      hashModule,
      'filterUsingGlobPatterns'
    );

    expect(
      createPackageJson(
        'lib1',
        {
          nodes: {
            lib1: {
              type: 'lib',
              name: 'lib1',
              data: {
                root: 'libs/lib1',
                targets: {
                  build: {},
                },
              },
            },
            lib2: {
              type: 'lib',
              name: 'lib2',
              data: {
                root: 'libs/lib2',
                targets: {
                  build: {},
                },
              },
            },
            lib3: {
              type: 'lib',
              name: 'lib3',
              data: {
                root: 'libs/lib3',
                targets: {
                  build: {},
                },
              },
            },
            lib4: {
              type: 'lib',
              name: 'lib4',
              data: {
                root: 'libs/lib4',
                targets: {
                  build: {},
                },
              },
            },
          },
          externalNodes: {
            'npm:axios': {
              type: 'npm',
              name: 'npm:axios',
              data: { version: '1.0.0', hash: '', packageName: 'axios' },
            },
          },
          dependencies: {},
        },
        { isProduction: true, root: '' }
      )
    ).toEqual({
      name: 'lib1',
      version: '0.0.1',
    });

    expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
      1,
      'libs/lib1',
      expect.anything(),
      expect.anything()
    );

    expect(filterUsingGlobPatternsSpy).toHaveBeenCalledTimes(1);
  });

  it('should exclude devDependencies from production build when local package.json is imported', () => {
    vi.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
      namedInputs: {
        default: ['{projectRoot}/**/*'],
        production: ['!{projectRoot}/**/*.spec.ts'],
      },
      targetDefaults: {
        build: {
          inputs: ['default', 'production', '^production'],
        },
      },
    });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
      name: 'project1',
      version: '1.0.0',
      dependencies: {
        axios: '1.0.0',
        tslib: '2.4.0',
        jest: '29.0.0',
        typescript: '4.8.4',
      },
      devDependencies: {
        webpack: '1.0.0',
      },
    });

    expect(
      createPackageJson(
        'lib1',
        {
          nodes: {
            lib1: {
              type: 'lib',
              name: 'lib1',
              data: {
                root: 'libs/lib1',
                targets: {
                  build: {},
                },
              },
            },
            lib2: {
              type: 'lib',
              name: 'lib2',
              data: {
                root: 'libs/lib2',
                targets: {
                  build: {},
                },
              },
            },
          },
          externalNodes: {
            'npm:tslib': {
              type: 'npm',
              name: 'npm:tslib',
              data: { version: '2.4.0', hash: '', packageName: 'tslib' },
            },
            'npm:typescript': {
              type: 'npm',
              name: 'npm:typescript',
              data: { version: '4.8.4', hash: '', packageName: 'typescript' },
            },
            'npm:jest': {
              type: 'npm',
              name: 'npm:jest',
              data: { version: '29.0.0', hash: '', packageName: 'jest' },
            },
            'npm:axios': {
              type: 'npm',
              name: 'npm:jest',
              data: { version: '1.0.0', hash: '', packageName: 'axios' },
            },
          },
          dependencies: {},
        },
        {
          target: 'build',
          isProduction: true,
          helperDependencies: ['npm:tslib'],
          root: '',
        }
      )
    ).toEqual({
      dependencies: {
        axios: '1.0.0',
        jest: '29.0.0',
        tslib: '2.4.0',
        typescript: '4.8.4',
      },
      name: 'project1',
      version: '1.0.0',
    });
  });

  describe('parsing "package.json"', () => {
    const appDependencies = [
      { source: 'app1', target: 'npm:@nx/devkit', type: 'static' },
      { source: 'app1', target: 'npm:typescript', type: 'static' },
    ];

    const libDependencies = [
      { source: 'lib1', target: 'npm:@nx/devkit', type: 'static' },
      { source: 'lib1', target: 'npm:tslib', type: 'static' },
      { source: 'lib1', target: 'npm:typescript', type: 'static' },
    ];

    const graph: ProjectGraph = {
      nodes: {
        app1: {
          type: 'app',
          name: 'app1',
          data: {
            targets: {},
            root: 'apps/app1',
          },
        },
        lib1: {
          type: 'lib',
          name: 'lib1',
          data: {
            targets: {},
            root: 'libs/lib1',
          },
        },
      },
      externalNodes: {
        'npm:@nx/devkit': {
          type: 'npm',
          name: 'npm:@nx/devkit',
          data: { version: '16.0.3', hash: '', packageName: '@nx/devkit' },
        },
        'npm:nx': {
          type: 'npm',
          name: 'npm:nx',
          data: { version: '16.0.3', hash: '', packageName: 'nx' },
        },
        'npm:tslib': {
          type: 'npm',
          name: 'npm:tslib',
          data: { version: '2.4.4', hash: '', packageName: 'tslib' },
        },
        'npm:typescript': {
          type: 'npm',
          name: 'npm:typescript',
          data: { version: '4.9.5', hash: '', packageName: 'typescript' },
        },
        'npm:foo': {
          type: 'npm',
          name: 'npm:foo',
          data: { version: '1.0.0', hash: '', packageName: 'foo' },
        },
        'npm:bar': {
          type: 'npm',
          name: 'npm:bar',
          data: { version: '4.9.5', hash: '', packageName: 'bar' },
        },
        'npm:qux': {
          type: 'npm',
          name: 'npm:qux',
          data: { version: '1.0.0', hash: '', packageName: 'qux' },
        },
      },
      dependencies: {
        app1: appDependencies,
        lib1: libDependencies,
      },
    };

    const fileMap: ProjectFileMap = {
      app1: [
        createFile(`apps/app1/src/main.ts`, [
          'npm:@nx/devkit',
          'npm:typecript',
        ]),
      ],
      lib1: [
        createFile(`libs/lib1/src/main.ts`, [
          'npm:@nx/devkit',
          'npm:typecript',
          'npm:tslib',
        ]),
      ],
    };

    const rootPackageJson = () => ({
      dependencies: {
        '@nx/devkit': '~16.0.0',
        nx: '> 14',
        typescript: '^4.8.2',
        tslib: '~2.4.0',
      },
    });

    const projectPackageJson = () => ({
      name: 'other-name',
      version: '1.2.3',
      dependencies: {
        typescript: '^4.8.4',
        random: '1.0.0',
      },
    });

    const npmLockFile = (projectGraph: ProjectGraph) => ({
      packages: Object.fromEntries(
        Object.values(projectGraph.externalNodes).map(
          ({ data: { packageName, version } }) => [
            `node_modules/${packageName}`,
            {
              version,
              resolved: `https://registry.npmjs.org/${packageName}/-/${packageName}-${version}.tgz`,
            },
          ]
        )
      ),
    });

    const spies = [];

    beforeAll(() => {
      spies.push(
        vi
          .spyOn(hashModule, 'filterUsingGlobPatterns')
          .mockImplementation((root) => {
            if (root === 'libs/lib1') {
              return fileMap['lib1'];
            } else {
              return fileMap['app1'];
            }
          })
      );
    });

    afterEach(() => {
      while (spies.length > 0) {
        spies.pop().mockRestore();
      }
      vi.resetAllMocks();
    });

    it('should use fixed versions when creating package json for apps', () => {
      spies.push(vi.spyOn(configModule, 'readNxJson').mockReturnValue({}));
      spies.push(
        vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'apps/app1/package.json') {
            return false;
          }
        })
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return rootPackageJson();
          }
        })
      );

      expect(createPackageJson('app1', graph, { root: '' }, fileMap)).toEqual({
        name: 'app1',
        version: '0.0.1',
        dependencies: {
          '@nx/devkit': '16.0.3',
          nx: '16.0.3',
        },
      });
    });

    it('should override fixed versions with local ranges when creating package json for apps', () => {
      spies.push(vi.spyOn(configModule, 'readNxJson').mockReturnValue({}));
      spies.push(
        vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'apps/app1/package.json') {
            return true;
          }
        })
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return rootPackageJson();
          }
          if (path === 'apps/app1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson(
          'app1',
          graph,
          {
            root: '',
          },
          fileMap
        )
      ).toEqual({
        name: 'other-name',
        version: '1.2.3',
        dependencies: {
          '@nx/devkit': '16.0.3',
          nx: '16.0.3',
          random: '1.0.0',
          typescript: '^4.8.4',
        },
      });
    });

    it('should use range versions when creating package json for libs', () => {
      spies.push(vi.spyOn(configModule, 'readNxJson').mockReturnValue({}));
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return rootPackageJson();
          }
        })
      );

      expect(
        createPackageJson(
          'lib1',
          graph,
          {
            root: '',
          },
          fileMap
        )
      ).toEqual({
        name: 'lib1',
        version: '0.0.1',
        dependencies: {
          '@nx/devkit': '~16.0.0',
          tslib: '~2.4.0',
        },
      });
    });

    it('should override range versions with local ranges when creating package json for libs', () => {
      spies.push(
        vi
          .spyOn(configModule, 'readNxJson')
          .mockReturnValue({ cli: { packageManager: 'pnpm' } })
      );
      spies.push(
        vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'libs/lib1/package.json') {
            return true;
          }
        })
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return rootPackageJson();
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson(
          'lib1',
          graph,
          {
            root: '',
          },
          fileMap
        )
      ).toEqual({
        name: 'other-name',
        version: '1.2.3',
        dependencies: {
          '@nx/devkit': '~16.0.0',
          tslib: '~2.4.0',
          random: '1.0.0',
          typescript: '^4.8.4',
        },
      });
    });

    it('should add packageManager if missing', () => {
      spies.push(
        vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'libs/lib1/package.json') {
            return true;
          }
          if (path === 'package.json') {
            return true;
          }
        })
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              packageManager: 'yarn',
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        packageManager: 'yarn',
        version: '1.2.3',
      });
    });

    it('should support skipping packageManager entry', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' || path === 'package.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              packageManager: 'yarn',
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
          skipPackageManager: true,
        }).packageManager
      ).toBeUndefined();
    });

    it('should replace packageManager if not in sync with root and show warning', () => {
      spies.push(
        vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'libs/lib1/package.json') {
            return true;
          }
          if (path === 'package.json') {
            return true;
          }
        })
      );
      const consoleWarnSpy = vi.spyOn(process.stderr, 'write');
      spies.push(consoleWarnSpy);
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              packageManager: 'yarn@1.2',
            };
          }
          if (path === 'libs/lib1/package.json') {
            return {
              ...projectPackageJson(),
              packageManager: 'yarn@4.3',
            };
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        packageManager: 'yarn@1.2',
        version: '1.2.3',
      });
      expect(JSON.stringify(consoleWarnSpy.mock.calls)).toMatch(
        /Package Manager Mismatch/
      );
    });

    it('should add overrides (pnpm)', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' ||
              path === 'apps/app1/package.json' ||
              path === 'package.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              pnpm: {
                overrides: {
                  foo: '1.0.0',
                },
              },
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
          if (path === 'apps/app1/package.json') {
            return {
              ...projectPackageJson(),
              pnpm: {
                overrides: {
                  foo: '2.0.0',
                  bar: '1.0.0',
                },
              },
            };
          }
        })
      );

      // Without a pruned lockfile a fresh install needs the overrides to resolve.
      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        pnpm: {
          overrides: {
            foo: '1.0.0',
          },
        },
      });
      expect(
        createPackageJson('app1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        pnpm: {
          overrides: {
            foo: '2.0.0',
            bar: '1.0.0',
          },
        },
      });
    });

    it('should copy pnpm install configuration from root', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' || path === 'package.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              pnpm: {
                onlyBuiltDependencies: ['sharp', 'bcrypt'],
                neverBuiltDependencies: ['fsevents'],
                allowBuilds: { esbuild: true, rollup: false },
                supportedArchitectures: {
                  os: ['linux'],
                  cpu: ['x64'],
                },
                ignoredOptionalDependencies: ['fsevents'],
              },
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        pnpm: {
          onlyBuiltDependencies: ['sharp', 'bcrypt'],
          neverBuiltDependencies: ['fsevents'],
          allowBuilds: { esbuild: true, rollup: false },
          supportedArchitectures: {
            os: ['linux'],
            cpu: ['x64'],
          },
          ignoredOptionalDependencies: ['fsevents'],
        },
      });
    });

    it('should add overrides (npm)', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' ||
              path === 'apps/app1/package.json' ||
              path === 'package.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              overrides: {
                foo: '1.0.0',
              },
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
          if (path === 'apps/app1/package.json') {
            return {
              ...projectPackageJson(),
              overrides: {
                foo: '2.0.0',
                bar: '1.0.0',
              },
            };
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        overrides: {
          foo: '1.0.0',
        },
      });
      expect(
        createPackageJson('app1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        overrides: {
          foo: '2.0.0',
          bar: '1.0.0',
        },
      });
    });

    it('should drop npm overrides that target a direct dependency', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' || path === 'package.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              overrides: {
                // `typescript` is a direct dependency of the generated
                // package.json - npm would reject this with EOVERRIDE.
                typescript: '5.0.0',
                // transitive-only override - must be carried through.
                foo: '1.0.0',
              },
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        overrides: {
          foo: '1.0.0',
        },
      });
    });

    it('should omit npm overrides when every entry targets a direct dependency', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' || path === 'package.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              overrides: {
                typescript: '5.0.0',
                random: '2.0.0',
              },
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      const result = createPackageJson('lib1', graph, {
        root: '',
      });
      expect(result).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
      });
      expect(result).not.toHaveProperty('overrides');
    });

    it('should keep an npm override that only constrains the dependencies of a direct dependency', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' || path === 'package.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              overrides: {
                // `typescript` is a direct dependency of the generated
                // package.json, but this sets no version for `typescript`
                // itself, so npm accepts it and it is what makes a
                // conflicting peer requirement resolvable in the dist.
                typescript: { foo: '1.0.0' },
              },
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        overrides: {
          typescript: { foo: '1.0.0' },
        },
      });
    });

    it('should drop only the "." key of an npm override on a direct dependency', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' ||
              path === 'package.json' ||
              path === 'package-lock.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              overrides: {
                // `.` sets the version of `typescript` itself, which npm
                // rejects with EOVERRIDE against the direct dependency, while
                // `foo` only constrains its dependencies and is kept.
                typescript: { '.': '5.0.0', foo: '1.0.0' },
                // transitive-only, in either form - must be carried through.
                qux: '1.0.0',
                bar: { '.': '2.0.0' },
              },
            };
          }
          if (path === 'package-lock.json') {
            const { packages } = npmLockFile(graph);
            return {
              packages: {
                ...packages,
                // qux accepts the installed typescript without the `.` value.
                'node_modules/qux': {
                  ...packages['node_modules/qux'],
                  dependencies: { typescript: '^4.8.4' },
                },
              },
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        overrides: {
          typescript: { foo: '1.0.0' },
          qux: '1.0.0',
          bar: { '.': '2.0.0' },
        },
      });
    });

    it('should drop an npm override on a direct dependency that only has a "." key', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' ||
              path === 'package.json' ||
              path === 'package-lock.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              overrides: {
                typescript: { '.': '5.0.0' },
              },
            };
          }
          if (path === 'package-lock.json') {
            return npmLockFile(graph);
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).not.toHaveProperty('overrides');
    });

    it('should take a "." npm override on a direct dependency from the root package.json, not the project package.json', () => {
      spies.push(vi.spyOn(configModule, 'readNxJson').mockReturnValue({}));
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' ||
              path === 'package.json' ||
              path === 'package-lock.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              overrides: { typescript: { '.': '^4.8.2', foo: '1.0.0' } },
            };
          }
          if (path === 'package-lock.json') {
            return npmLockFile(graphWithRandom);
          }
          if (path === 'libs/lib1/package.json') {
            // npm ignores overrides outside the root package.json, so the
            // workspace lockfile was resolved with the root's rules only.
            return {
              ...projectPackageJson(),
              overrides: {
                typescript: { '.': '5.0.0', foo: '2.0.0' },
                random: { '.': '1.0.0', foo: '1.0.0' },
              },
            };
          }
        })
      );

      const graphWithRandom: ProjectGraph = {
        ...graph,
        externalNodes: {
          ...graph.externalNodes,
          'npm:random': {
            type: 'npm',
            name: 'npm:random',
            data: { version: '1.0.0', hash: '', packageName: 'random' },
          },
        },
      };

      expect(
        createPackageJson('lib1', graphWithRandom, { root: '' }).overrides
      ).toEqual({
        typescript: { foo: '1.0.0' },
      });
    });

    it('should keep the rest of a "." npm override on a direct dependency of a standalone project', () => {
      spies.push(vi.spyOn(configModule, 'readNxJson').mockReturnValue({}));
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) => path === 'package.json' || path === 'package-lock.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              name: 'standalone',
              version: '1.0.0',
              overrides: { '@nx/devkit': { '.': '~16.0.0', foo: '1.0.0' } },
            };
          }
          if (path === 'package-lock.json') {
            return npmLockFile(standaloneGraph);
          }
        })
      );
      const standaloneGraph: ProjectGraph = {
        ...graph,
        nodes: {
          ...graph.nodes,
          lib1: {
            ...graph.nodes.lib1,
            data: { ...graph.nodes.lib1.data, root: '.' },
          },
        },
      };

      const packageJson = createPackageJson(
        'lib1',
        standaloneGraph,
        { root: '' },
        fileMap
      );

      expect(packageJson.dependencies).toHaveProperty('@nx/devkit');
      expect(packageJson.overrides).toEqual({
        '@nx/devkit': { foo: '1.0.0' },
      });
    });

    it('should replace "$name" values in the "." npm override of a direct dependency with the root spec', () => {
      spies.push(vi.spyOn(configModule, 'readNxJson').mockReturnValue({}));
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' ||
              path === 'package.json' ||
              path === 'package-lock.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              overrides: {
                // `$tslib` and `$typescript` take the root spec whether or not
                // the generated package.json declares them.
                typescript: {
                  '.': '$typescript',
                  tslib: '$tslib',
                  bar: '$typescript',
                },
                nx: { '.': '$nx' },
                qux: '$tslib',
              },
            };
          }
          if (path === 'package-lock.json') {
            return npmLockFile(graph);
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
        })
      );

      expect(createPackageJson('lib1', graph, { root: '' }).overrides).toEqual({
        typescript: { tslib: '~2.4.0', bar: '^4.8.2' },
        nx: { '.': '$nx' },
        qux: '$tslib',
      });
    });

    it.each<
      [
        string,
        PackageJson['overrides'],
        {
          packages?: [string, string][];
          workspacePackages?: string[];
          lockfile?: Record<
            string,
            {
              version?: string;
              link?: boolean;
              resolved?: string;
              peerDependencies?: Record<string, string>;
            }
          > | null;
        },
        PackageJson['overrides'] | undefined,
        Record<string, string>?,
      ]
    >([
      [
        'the workspace lockfile has no package for it',
        { random: { '.': '1.0.0', foo: '1.0.0' } },
        {},
        undefined,
      ],
      [
        'a copy of it is linked',
        { typescript: { '.': '^4.8.2', foo: '1.0.0' } },
        {
          lockfile: {
            'node_modules/typescript': { link: true, resolved: 'libs/ts' },
          },
        },
        undefined,
      ],
      [
        'a copy of it comes from a local tarball',
        { typescript: { '.': '^4.8.2', foo: '1.0.0' } },
        {
          lockfile: {
            'node_modules/qux/node_modules/typescript': {
              resolved: 'file:vendor/typescript-4.8.4.tgz',
            },
          },
        },
        undefined,
      ],
      [
        'a package depends on it with a range a copy of it does not satisfy',
        { typescript: { '.': '^4.8.2', foo: '1.0.0' } },
        {
          lockfile: {
            'node_modules/qux': {
              version: '1.0.0',
              peerDependencies: { typescript: '^5.0.0' },
            },
          },
        },
        undefined,
      ],
      [
        'a package depends on another dropped override with a range a copy does not satisfy',
        { typescript: { '.': '^4.8.2', foo: '1.0.0' }, random: '1.0.0' },
        {
          packages: [['random', '1.0.0']],
          lockfile: {
            'node_modules/qux': {
              version: '1.0.0',
              peerDependencies: { random: '^2.0.0' },
            },
          },
        },
        undefined,
      ],
      [
        'the workspace has no npm lockfile',
        { typescript: { '.': '^4.8.2', foo: '1.0.0' } },
        { lockfile: null },
        undefined,
      ],
      [
        'a package it pins is not installed',
        { typescript: { '.': '^4.8.2', foo: '1.0.0', missing: '1.0.0' } },
        {},
        undefined,
      ],
      [
        'a package it pins is a workspace package',
        { typescript: { '.': '^4.8.2', foo: '1.0.0' } },
        { workspacePackages: ['foo'] },
        undefined,
      ],
      [
        'an installed copy of a package it pins has another version',
        { typescript: { '.': '^4.8.2', foo: '1.0.0' } },
        { packages: [['foo', '2.0.0']] },
        undefined,
      ],
      [
        'it holds a "$name" the root does not declare',
        { typescript: { '.': '^4.8.2', foo: '1.0.0', bar: '$missing' } },
        {},
        undefined,
      ],
      [
        'it holds a "$name" the root declares as "*"',
        { typescript: { '.': '^4.8.2', foo: '$qux' } },
        {},
        undefined,
        { qux: '*' },
      ],
      [
        'it holds a local path',
        { typescript: { '.': '^4.8.2', foo: '1.0.0', bar: 'file:../bar' } },
        {},
        undefined,
      ],
      [
        'it holds a nested override',
        { typescript: { '.': '^4.8.2', foo: '1.0.0', bar: { qux: '1.0.0' } } },
        {},
        undefined,
      ],
      [
        'another override has nested rules',
        {
          nx: { qux: '1.0.0' },
          typescript: { '.': '^4.8.2', foo: '1.0.0' },
        },
        {},
        { nx: { qux: '1.0.0' } },
      ],
      [
        'another override has a range',
        {
          'qux@^2.0.0': '1.0.0',
          typescript: { '.': '^4.8.2', foo: '1.0.0' },
        },
        {},
        { 'qux@^2.0.0': '1.0.0' },
      ],
      [
        'another override names a package it pins',
        { foo: '1.0.0', typescript: { '.': '^4.8.2', foo: '1.0.0' } },
        {},
        { foo: '1.0.0' },
      ],
      [
        'another kept override pins the same package',
        {
          typescript: { '.': '^4.8.2', foo: '1.0.0' },
          random: { '.': '1.0.0', foo: '1.0.0' },
        },
        { packages: [['random', '1.0.0']] },
        undefined,
      ],
      [
        'it pins a package twice',
        {
          typescript: {
            '.': '^4.8.2',
            'foo@^1.0.0': '1.0.0',
            'foo@>=1.0.0': '1.0.0',
          },
        },
        {},
        undefined,
      ],
    ])(
      'should drop a "." npm override on a direct dependency when %s',
      (_, rootOverrides, installed, expected, rootDependencies = {}) => {
        spies.push(vi.spyOn(configModule, 'readNxJson').mockReturnValue({}));
        spies.push(
          vi
            .spyOn(fs, 'existsSync')
            .mockImplementation(
              (path) =>
                path === 'libs/lib1/package.json' ||
                path === 'package.json' ||
                (path === 'package-lock.json' && installed.lockfile !== null)
            )
        );
        spies.push(
          vi
            .spyOn(fileutilsModule, 'readJsonFile')
            .mockImplementation((path) => {
              if (path === 'package-lock.json') {
                const lockFile = npmLockFile(installedGraph);
                return {
                  packages: { ...lockFile.packages, ...installed.lockfile },
                };
              }
              if (path === 'package.json') {
                const root = rootPackageJson();
                return {
                  ...root,
                  dependencies: { ...root.dependencies, ...rootDependencies },
                  overrides: rootOverrides,
                };
              }
              if (path === 'libs/lib1/package.json') {
                return projectPackageJson();
              }
            })
        );
        const installedGraph: ProjectGraph = {
          ...graph,
          nodes: {
            ...graph.nodes,
            ...Object.fromEntries(
              (installed.workspacePackages ?? []).map((packageName) => [
                packageName,
                {
                  type: 'lib' as const,
                  name: packageName,
                  data: {
                    root: `libs/${packageName}`,
                    metadata: { js: { packageName } },
                  },
                },
              ])
            ),
          },
          externalNodes: {
            ...graph.externalNodes,
            ...Object.fromEntries(
              (installed.packages ?? []).map(([packageName, version]) => [
                `npm:${packageName}@${version}`,
                {
                  type: 'npm' as const,
                  name: `npm:${packageName}@${version}` as const,
                  data: { version, hash: '', packageName },
                },
              ])
            ),
          },
        };

        expect(
          createPackageJson('lib1', installedGraph, { root: '' }).overrides
        ).toEqual(expected);
      }
    );

    it('should add resolutions (yarn)', () => {
      spies.push(
        vi
          .spyOn(fs, 'existsSync')
          .mockImplementation(
            (path) =>
              path === 'libs/lib1/package.json' ||
              path === 'apps/app1/package.json' ||
              path === 'package.json'
          )
      );
      spies.push(
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) => {
          if (path === 'package.json') {
            return {
              ...rootPackageJson(),
              resolutions: {
                foo: '1.0.0',
              },
            };
          }
          if (path === 'libs/lib1/package.json') {
            return projectPackageJson();
          }
          if (path === 'apps/app1/package.json') {
            return {
              ...projectPackageJson(),
              resolutions: {
                foo: '2.0.0',
                bar: '1.0.0',
              },
            };
          }
        })
      );

      expect(
        createPackageJson('lib1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        resolutions: {
          foo: '1.0.0',
        },
      });
      expect(
        createPackageJson('app1', graph, {
          root: '',
        })
      ).toEqual({
        dependencies: {
          random: '1.0.0',
          typescript: '^4.8.4',
        },
        name: 'other-name',
        version: '1.2.3',
        resolutions: {
          foo: '2.0.0',
          bar: '1.0.0',
        },
      });
    });
  });

  describe('nested library dependencies', () => {
    it('should include dependencies from nested libraries (App -> lib1 -> lib2)', () => {
      const mockFilterUsingGlobPatterns = vi.spyOn(
        hashModule,
        'filterUsingGlobPatterns'
      );
      const mockGetTargetInputs = vi.spyOn(hashModule, 'getTargetInputs');
      const mockReadNxJson = vi.spyOn(configModule, 'readNxJson');

      // Mock restrictive patterns that would miss nested dependencies
      mockGetTargetInputs.mockReturnValue({
        selfInputs: ['production'],
        dependencyInputs: ['^production'],
      });

      mockReadNxJson.mockReturnValue({
        namedInputs: {
          production: [
            'default',
            '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
          ],
        },
      } as any);

      mockFilterUsingGlobPatterns.mockImplementation(
        (root, files, patterns) => {
          if (root === 'apps/myapp') {
            return files.filter((f) => f.file.includes('main.ts'));
          }

          if (root === 'libs/lib1' && patterns.includes('^production')) {
            return files.filter((f) => f.file.includes('index.ts'));
          }

          if (root === 'libs/lib1' && patterns.includes('{projectRoot}/**/*')) {
            return files;
          }

          if (root === 'libs/lib2' && patterns.includes('^production')) {
            return [];
          }
          if (root === 'libs/lib2' && patterns.includes('{projectRoot}/**/*')) {
            return files; // This is the fix - broad patterns find all files
          }
          return files;
        }
      );

      const graph: ProjectGraph = {
        nodes: {
          myapp: {
            type: 'app',
            name: 'myapp',
            data: {
              targets: { build: {} },
              root: 'apps/myapp',
            },
          },
          lib1: {
            type: 'lib',
            name: 'lib1',
            data: {
              targets: { build: {} },
              root: 'libs/lib1',
            },
          },
          lib2: {
            type: 'lib',
            name: 'lib2',
            data: {
              targets: { build: {} },
              root: 'libs/lib2',
            },
          },
        },
        externalNodes: {
          'npm:lodash': {
            type: 'npm',
            name: 'npm:lodash',
            data: { version: '4.17.21', hash: '', packageName: 'lodash' },
          },
          'npm:axios': {
            type: 'npm',
            name: 'npm:axios',
            data: { version: '1.0.0', hash: '', packageName: 'axios' },
          },
        },
        dependencies: {
          myapp: [
            { source: 'myapp', target: 'lib1', type: DependencyType.static },
          ],
          lib1: [
            { source: 'lib1', target: 'lib2', type: DependencyType.static },
          ],
          lib2: [],
        },
      };

      const fileMap: ProjectFileMap = {
        myapp: [
          createFile('apps/myapp/src/main.ts', [
            ['apps/myapp/src/main.ts', 'lib1', DependencyType.static],
          ]),
        ],
        lib1: [
          createFile('libs/lib1/src/index.ts', [
            ['libs/lib1/src/index.ts', 'lib2', DependencyType.static],
            ['libs/lib1/src/index.ts', 'npm:axios', DependencyType.static],
          ]),
        ],
        lib2: [
          createFile('libs/lib2/src/index.ts', [
            ['libs/lib2/src/index.ts', 'npm:lodash', DependencyType.static],
          ]),
          createFile('libs/lib2/src/utils.ts', [
            ['libs/lib2/src/utils.ts', 'npm:lodash', DependencyType.static],
          ]),
        ],
      };

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
        name: 'root-package',
        dependencies: {},
      });

      const result = createPackageJson(
        'myapp',
        graph,
        {
          target: 'build',
          root: '',
          isProduction: true,
        },
        fileMap
      );

      expect(result.dependencies).toEqual({
        axios: '1.0.0',
        lodash: '4.17.21',
      });

      mockFilterUsingGlobPatterns.mockRestore();
      mockGetTargetInputs.mockRestore();
      mockReadNxJson.mockRestore();
    });
  });

  describe('package aliases', () => {
    it('should preserve alias dependency keys when canonical packages also exist in the graph', () => {
      const mockReadNxJson = vi
        .spyOn(configModule, 'readNxJson')
        .mockReturnValue({});
      const mockGetTargetInputs = vi
        .spyOn(hashModule, 'getTargetInputs')
        .mockReturnValue({
          selfInputs: ['{projectRoot}/**/*'],
          dependencyInputs: [],
        });
      const mockFilterUsingGlobPatterns = vi
        .spyOn(hashModule, 'filterUsingGlobPatterns')
        .mockImplementation((_root, files) => files);

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
        name: 'root-package',
        dependencies: {
          zod: '^3.0.0',
          zod4: 'npm:zod@^4.1.13',
        },
      });

      const graph: ProjectGraph = {
        nodes: {
          myapp: {
            type: 'app',
            name: 'myapp',
            data: {
              targets: { build: {} },
              root: 'apps/myapp',
            },
          },
        },
        externalNodes: {
          'npm:zod': {
            type: 'npm',
            name: 'npm:zod',
            data: { version: '^3.0.0', hash: '', packageName: 'zod' },
          },
          'npm:zod@4.1.13': {
            type: 'npm',
            name: 'npm:zod@4.1.13',
            data: { version: '4.1.13', hash: '', packageName: 'zod' },
          },
          'npm:zod4': {
            type: 'npm',
            name: 'npm:zod4',
            data: {
              version: 'npm:zod@4.1.13',
              hash: '',
              packageName: 'zod4',
            },
          },
        },
        dependencies: {
          myapp: [
            {
              source: 'myapp',
              target: 'npm:zod4',
              type: DependencyType.static,
            },
          ],
        },
      };

      const fileMap: ProjectFileMap = {
        myapp: [
          createFile('apps/myapp/src/main.ts', [
            ['apps/myapp/src/main.ts', 'npm:zod4', DependencyType.static],
          ]),
        ],
      };

      const result = createPackageJson(
        'myapp',
        graph,
        {
          target: 'build',
          root: '',
          isProduction: true,
        },
        fileMap
      );

      expect(result.dependencies).toEqual({
        zod4: 'npm:zod@4.1.13',
      });

      mockFilterUsingGlobPatterns.mockRestore();
      mockGetTargetInputs.mockRestore();
      mockReadNxJson.mockRestore();
    });
  });

  describe('peer dependencies', () => {
    beforeEach(() => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({});
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function createAppPackageJson(dependencies: string[], peers: string[]) {
      const externalNodes: ProjectGraph['externalNodes'] = {};
      for (const packageName of [...dependencies, ...peers]) {
        externalNodes[`npm:${packageName}`] = {
          type: 'npm',
          name: `npm:${packageName}`,
          data: { version: '1.0.0', hash: '', packageName },
        };
      }
      return createPackageJson(
        'app',
        {
          nodes: {
            app: { type: 'app', name: 'app', data: { root: 'apps/app' } },
          },
          externalNodes,
          dependencies: {},
        },
        {
          helperDependencies: dependencies.map((name) => `npm:${name}`),
          root: '',
        }
      );
    }

    it('collects the peers of a package whose package.json require cannot read', () => {
      manifests['fixture-host'] = { peerDependencies: { 'fixture-peer': '*' } };

      expect(
        createAppPackageJson(['fixture-host'], ['fixture-peer'])
          .peerDependencies
      ).toEqual({ 'fixture-peer': '1.0.0' });
    });

    it.each([
      [
        'the required host is visited last',
        ['fixture-optional-host', 'fixture-required-host'],
        undefined,
      ],
      [
        'the required host is visited first',
        ['fixture-required-host', 'fixture-optional-host'],
        undefined,
      ],
      [
        'every host marks it optional',
        ['fixture-optional-host', 'fixture-other-optional-host'],
        { 'fixture-shared-peer': { optional: true } },
      ],
    ])(
      'marks a shared peer optional only when every host does: %s',
      (_, hosts, expectedPeerDependenciesMeta) => {
        const optionalPeer = {
          peerDependencies: { 'fixture-shared-peer': '*' },
          peerDependenciesMeta: { 'fixture-shared-peer': { optional: true } },
        };
        manifests['fixture-optional-host'] = optionalPeer;
        manifests['fixture-other-optional-host'] = optionalPeer;
        manifests['fixture-required-host'] = {
          peerDependencies: { 'fixture-shared-peer': '*' },
        };

        const { peerDependencies, peerDependenciesMeta } = createAppPackageJson(
          hosts,
          ['fixture-shared-peer']
        );

        expect({ peerDependencies, peerDependenciesMeta }).toEqual({
          peerDependencies: { 'fixture-shared-peer': '1.0.0' },
          peerDependenciesMeta: expectedPeerDependenciesMeta,
        });
      }
    );

    it('reads each package.json once across calls', () => {
      manifests['fixture-repeated-host'] = {};

      createAppPackageJson(['fixture-repeated-host'], []);
      createAppPackageJson(['fixture-repeated-host'], []);

      expect(readModulePackageJson).toHaveBeenCalledTimes(1);
    });

    it('reports a package.json it cannot read in verbose mode', () => {
      vi.stubEnv('NX_VERBOSE_LOGGING', 'true');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createAppPackageJson(['fixture-unreadable'], []);

      expect(warn).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('fixture-unreadable')
      );
    });
  });

  describe('local-path dependencies', () => {
    beforeEach(() => {
      vi.spyOn(hashModule, 'getTargetInputs').mockReturnValue({
        selfInputs: ['{projectRoot}/**/*'],
        dependencyInputs: ['{projectRoot}/**/*'],
      });
      vi.spyOn(hashModule, 'filterUsingGlobPatterns').mockImplementation(
        (_root, files) => files
      );
    });

    // A directory's graph version is relative to the workspace root. pnpm
    // records a tarball from the root as well.
    const createGraph = (tarballVersion: string): ProjectGraph => ({
      nodes: {
        myapp: {
          type: 'app',
          name: 'myapp',
          data: { targets: { build: {} }, root: 'apps/myapp' },
        },
        lib1: {
          type: 'lib',
          name: 'lib1',
          data: { targets: { build: {} }, root: 'libs/lib1' },
        },
      },
      externalNodes: {
        'npm:libvend': {
          type: 'npm',
          name: 'npm:libvend',
          data: {
            version: 'file:vendor/libvend',
            hash: '',
            packageName: 'libvend',
          },
        },
        'npm:ltar': {
          type: 'npm',
          name: 'npm:ltar',
          data: {
            version: tarballVersion,
            hash: '',
            packageName: 'ltar',
          },
        },
        'npm:abs': {
          type: 'npm',
          name: 'npm:abs',
          data: { version: 'file:/opt/abs', hash: '', packageName: 'abs' },
        },
        'npm:rootvend': {
          type: 'npm',
          name: 'npm:rootvend',
          data: {
            version: 'file:vendor/rootvend',
            hash: '',
            packageName: 'rootvend',
          },
        },
        'npm:ms': {
          type: 'npm',
          name: 'npm:ms',
          data: { version: '2.1.3', hash: '', packageName: 'ms' },
        },
      },
      dependencies: {
        myapp: [
          { source: 'myapp', target: 'lib1', type: DependencyType.static },
          {
            source: 'myapp',
            target: 'npm:rootvend',
            type: DependencyType.static,
          },
        ],
        lib1: [
          {
            source: 'lib1',
            target: 'npm:libvend',
            type: DependencyType.static,
          },
          { source: 'lib1', target: 'npm:ltar', type: DependencyType.static },
          { source: 'lib1', target: 'npm:abs', type: DependencyType.static },
          { source: 'lib1', target: 'npm:ms', type: DependencyType.static },
        ],
      },
    });
    const fileMap: ProjectFileMap = {
      myapp: [
        createFile('apps/myapp/src/main.ts', [
          ['apps/myapp/src/main.ts', 'lib1', DependencyType.static],
          ['apps/myapp/src/main.ts', 'npm:rootvend', DependencyType.static],
        ]),
      ],
      lib1: [
        createFile('libs/lib1/src/index.ts', [
          ['libs/lib1/src/index.ts', 'npm:libvend', DependencyType.static],
          ['libs/lib1/src/index.ts', 'npm:ltar', DependencyType.static],
          ['libs/lib1/src/index.ts', 'npm:abs', DependencyType.static],
          ['libs/lib1/src/index.ts', 'npm:ms', DependencyType.static],
        ]),
      ],
    };

    it.each([
      [
        'pnpm',
        'file:../../vendor/ltar-1.0.0.tgz',
        'file:vendor/ltar-1.0.0.tgz',
        {
          abs: 'file:/opt/abs',
          libvend: 'file:../../vendor/libvend',
          ltar: 'file:../../vendor/ltar-1.0.0.tgz',
          ms: '2.1.3',
          rootvend: 'file:../../vendor/rootvend',
        },
      ],
      [
        'npm',
        'file:../../vendor/ltar-1.0.0.tgz',
        '../../vendor/ltar-1.0.0.tgz',
        {
          abs: 'file:/opt/abs',
          libvend: 'file:vendor/libvend',
          ltar: '../../vendor/ltar-1.0.0.tgz',
          ms: '2.1.3',
          rootvend: 'file:vendor/rootvend',
        },
      ],
    ] as const)(
      'should declare an inherited local-path dependency relative to the project on %s with %s',
      (packageManager, tarballSpec, tarballVersion, expected) => {
        vi.spyOn(configModule, 'readNxJson').mockReturnValue({
          cli: { packageManager },
        });
        vi.spyOn(fs, 'existsSync').mockImplementation(
          (path) => path === 'libs/lib1/package.json'
        );
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) =>
          path === 'libs/lib1/package.json'
            ? {
                name: 'lib1',
                dependencies: {
                  abs: 'file:/opt/abs',
                  libvend: 'file:../../vendor/libvend/',
                  ltar: tarballSpec,
                  ms: '^2.1.0',
                },
              }
            : {
                name: 'root-package',
                dependencies: { rootvend: 'file:./vendor/rootvend' },
              }
        );

        const result = createPackageJson(
          'myapp',
          createGraph(tarballVersion),
          { target: 'build', root: '', isProduction: true },
          fileMap
        );

        expect(result.dependencies).toEqual(expected);
      }
    );

    // The app reaches lib2 only through a graph edge none of its files use,
    // like an excluded test importing a tool.
    it.each([
      [
        'pnpm',
        'npm:left-pad@1.3.0',
        'link:../../../vendor/x',
        'npm:left-pad@1.3.0',
        'npm:left-pad@1.3.0',
      ],
      [
        'pnpm',
        'link:../../../vendor/x',
        'link:../../../vendor/x',
        undefined,
        'link:../../vendor/x',
      ],
      [
        'pnpm',
        'npm:@s/x-real@file:vendor/@s/x',
        'link:../../../vendor/x',
        'file:./vendor/@s/x',
        'file:../../vendor/@s/x',
      ],
    ] as const)(
      'should rebase a declared local-path spec only for the graph version it records on %s (%s, lib2 declares %s)',
      (packageManager, graphVersion, lib2Spec, rootSpec, expected) => {
        vi.spyOn(configModule, 'readNxJson').mockReturnValue({
          cli: { packageManager },
        });
        vi.spyOn(fs, 'existsSync').mockImplementation(
          (path) => path === 'libs/nested/lib2/package.json'
        );
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation((path) =>
          path === 'libs/nested/lib2/package.json'
            ? { name: 'lib2', dependencies: { x: lib2Spec } }
            : {
                name: 'root-package',
                dependencies: rootSpec ? { x: rootSpec } : {},
              }
        );

        const result = createPackageJson(
          'myapp',
          {
            nodes: {
              myapp: {
                type: 'app',
                name: 'myapp',
                data: { targets: { build: {} }, root: 'apps/myapp' },
              },
              lib2: {
                type: 'lib',
                name: 'lib2',
                data: { targets: {}, root: 'libs/nested/lib2' },
              },
            },
            externalNodes: {
              'npm:x': {
                type: 'npm',
                name: 'npm:x',
                data: { version: graphVersion, hash: '', packageName: 'x' },
              },
            },
            dependencies: {
              myapp: [
                {
                  source: 'myapp',
                  target: 'npm:x',
                  type: DependencyType.static,
                },
                {
                  source: 'myapp',
                  target: 'lib2',
                  type: DependencyType.static,
                },
              ],
              lib2: [],
            },
          },
          { target: 'build', root: '', isProduction: true },
          {
            myapp: [
              createFile('apps/myapp/src/main.ts', [
                ['apps/myapp/src/main.ts', 'npm:x', DependencyType.static],
              ]),
            ],
            lib2: [],
          }
        );

        expect(result.dependencies).toEqual({ x: expected });
      }
    );

    // Unless a row sets `declarerSpec`, every declarer writes the same spec for
    // its own `vendor/x`, which only the resolution of the import tells apart.
    // `installed` maps the declarers whose node_modules links the package to
    // the link's target.
    it.each([
      {
        packageManager: 'pnpm',
        scenario: 'myapp imports it and lib2 declares it',
        importer: 'myapp',
        declarers: ['lib2'],
        edge: false,
        expected: 'link:../../vendor/x',
      },
      {
        packageManager: 'pnpm',
        scenario: 'lib2 imports and declares it',
        importer: 'lib2',
        declarers: ['lib2'],
        edge: false,
        expected: 'link:../../libs/nested/lib2/vendor/x',
      },
      {
        packageManager: 'pnpm',
        scenario: 'lib2 imports it and declares a link other than the root',
        importer: 'lib2',
        declarers: ['lib2'],
        declarerSpec: 'link:../vendor/x',
        installed: { lib2: 'libs/nested/vendor/x' },
        edge: false,
        expected: 'link:../../libs/nested/vendor/x',
      },
      {
        packageManager: 'pnpm',
        scenario:
          "lib2 imports it and an override links lib2's declaration to the root's copy",
        importer: 'lib2',
        declarers: ['lib2'],
        declarerSpec: 'link:../vendor/y',
        installed: { lib2: 'vendor/x' },
        edge: false,
        expected: 'link:../../vendor/x',
      },
      {
        packageManager: 'pnpm',
        scenario:
          'lib2 imports it and its parent declares a link nothing installed',
        importer: 'lib2',
        declarers: ['parent'],
        declarerSpec: 'link:vendor/other',
        edge: false,
        expected: 'link:../../vendor/x',
      },
      {
        packageManager: 'pnpm',
        scenario: 'lib2 imports it and its parent declares it',
        importer: 'lib2',
        declarers: ['parent'],
        edge: false,
        expected: 'link:../../libs/nested/vendor/x',
      },
      {
        packageManager: 'pnpm',
        scenario:
          'lib2 imports it and its parent, which it depends on, declares it',
        importer: 'lib2',
        declarers: ['parent'],
        edge: true,
        expected: 'link:../../libs/nested/vendor/x',
      },
      {
        packageManager: 'pnpm',
        scenario:
          'lib2 imports it and a project whose root only shares a prefix declares it',
        importer: 'lib2',
        declarers: ['prefixed'],
        edge: false,
        expected: 'link:../../vendor/x',
      },
    ] as const)(
      'should inherit the spec the import resolves to on $packageManager when $scenario',
      ({
        packageManager,
        importer,
        declarers,
        declarerSpec,
        installed,
        edge,
        expected,
      }) => {
        const graphVersion = 'link:vendor/x';
        const spec = 'link:vendor/x';
        const projectRoots = {
          lib2: 'libs/nested/lib2',
          parent: 'libs/nested',
          prefixed: 'libs/nest',
        };
        const manifests = Object.fromEntries(
          Object.entries(projectRoots).map(([name, projectRoot]) => [
            `${projectRoot}/package.json`,
            {
              name,
              dependencies: (declarers as readonly string[]).includes(name)
                ? { x: declarerSpec ?? spec }
                : {},
            },
          ])
        );
        vi.spyOn(configModule, 'readNxJson').mockReturnValue({
          cli: { packageManager },
        });
        const installedLinks: Record<string, string> = Object.fromEntries(
          Object.entries(installed ?? {}).map(([name, linkTarget]) => [
            `${projectRoots[name]}/node_modules/x`,
            linkTarget,
          ])
        );
        vi.spyOn(fs, 'existsSync').mockImplementation(
          (path) => typeof path === 'string' && path in manifests
        );
        vi.spyOn(fs, 'realpathSync').mockImplementation((path) => {
          const link = String(path);
          if (!link.includes('/node_modules/')) {
            return link;
          }
          if (!(link in installedLinks)) {
            throw new Error(`ENOENT: no such file or directory, '${link}'`);
          }
          return installedLinks[link];
        });
        vi.spyOn(fileutilsModule, 'readJsonFile').mockImplementation(
          (path) =>
            manifests[path] ?? {
              name: 'root-package',
              dependencies: { x: spec },
            }
        );
        const importsX = (project: string) =>
          project === importer
            ? [
                {
                  source: project,
                  target: 'npm:x',
                  type: DependencyType.static,
                },
              ]
            : [];

        const result = createPackageJson(
          'myapp',
          {
            nodes: {
              myapp: {
                type: 'app',
                name: 'myapp',
                data: { targets: { build: {} }, root: 'apps/myapp' },
              },
              ...Object.fromEntries(
                Object.entries(projectRoots).map(([name, projectRoot]) => [
                  name,
                  {
                    type: 'lib' as const,
                    name,
                    data: { targets: {}, root: projectRoot },
                  },
                ])
              ),
            },
            externalNodes: {
              'npm:x': {
                type: 'npm',
                name: 'npm:x',
                data: { version: graphVersion, hash: '', packageName: 'x' },
              },
            },
            dependencies: {
              myapp: [
                {
                  source: 'myapp',
                  target: 'lib2',
                  type: DependencyType.static,
                },
                ...importsX('myapp'),
              ],
              lib2: [
                ...(edge
                  ? [
                      {
                        source: 'lib2',
                        target: 'parent',
                        type: DependencyType.static,
                      },
                    ]
                  : []),
                ...importsX('lib2'),
              ],
              parent: [],
              prefixed: [],
            },
          },
          { target: 'build', root: '', isProduction: true },
          {
            myapp: [
              createFile('apps/myapp/src/main.ts', [
                [
                  'apps/myapp/src/main.ts',
                  importer === 'myapp' ? 'npm:x' : 'lib2',
                  DependencyType.static,
                ],
              ]),
            ],
            lib2:
              importer === 'lib2'
                ? [
                    createFile('libs/nested/lib2/src/index.ts', [
                      [
                        'libs/nested/lib2/src/index.ts',
                        'npm:x',
                        DependencyType.static,
                      ],
                    ]),
                  ]
                : [],
            parent: [],
            prefixed: [],
          }
        );

        expect(result.dependencies).toEqual({ x: expected });
      }
    );
  });
});

function createFile(f: string, deps?: FileDataDependency[]): FileData {
  return { file: f, hash: '', deps };
}
