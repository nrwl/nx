import * as fs from 'fs';

import * as configModule from '../../../config/configuration';
import {
  FileData,
  FileDataDependency,
  ProjectFileMap,
  ProjectGraph,
} from '../../../config/project-graph';
import * as hashModule from '../../../hasher/task-hasher';
import { createPackageJson } from './create-package-json';
import * as fileutilsModule from '../../../utils/fileutils';

describe('createPackageJson', () => {
  it('should add additional dependencies', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
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

  it('should only add file dependencies if target is specified', () => {
    jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
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

    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
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
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
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
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
      dependencies: {
        axios: '1.0.0',
        tslib: '2.4.0',
        jest: '29.0.0',
        typescript: '4.8.4',
      },
    });
    const filterUsingGlobPatternsSpy = jest.spyOn(
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
    jest.spyOn(configModule, 'readNxJson').mockReturnValueOnce({
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

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fileutilsModule, 'readJsonFile').mockReturnValue({
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

    const spies = [];

    beforeAll(() => {
      spies.push(
        jest
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
      jest.resetAllMocks();
    });

    it('should use fixed versions when creating package json for apps', () => {
      spies.push(
        jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'apps/app1/package.json') {
            return false;
          }
        })
      );
      spies.push(
        jest
          .spyOn(fileutilsModule, 'readJsonFile')
          .mockImplementation((path) => {
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
      spies.push(
        jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'apps/app1/package.json') {
            return true;
          }
        })
      );
      spies.push(
        jest
          .spyOn(fileutilsModule, 'readJsonFile')
          .mockImplementation((path) => {
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
      spies.push(
        jest
          .spyOn(fileutilsModule, 'readJsonFile')
          .mockImplementation((path) => {
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
        jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'libs/lib1/package.json') {
            return true;
          }
        })
      );
      spies.push(
        jest
          .spyOn(fileutilsModule, 'readJsonFile')
          .mockImplementation((path) => {
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
        jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'libs/lib1/package.json') {
            return true;
          }
          if (path === 'package.json') {
            return true;
          }
        })
      );
      spies.push(
        jest
          .spyOn(fileutilsModule, 'readJsonFile')
          .mockImplementation((path) => {
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

    it('should replace packageManager if not in sync with root and show warning', () => {
      spies.push(
        jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
          if (path === 'libs/lib1/package.json') {
            return true;
          }
          if (path === 'package.json') {
            return true;
          }
        })
      );
      const consoleWarnSpy = jest.spyOn(process.stdout, 'write');
      spies.push(consoleWarnSpy);
      spies.push(
        jest
          .spyOn(fileutilsModule, 'readJsonFile')
          .mockImplementation((path) => {
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
  });
});

function createFile(f: string, deps?: FileDataDependency[]): FileData {
  return { file: f, hash: '', deps };
}
