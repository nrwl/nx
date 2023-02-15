import * as fs from 'fs';

import * as configModule from '../../../config/configuration';
import { DependencyType } from '../../../config/project-graph';
import * as hashModule from '../../../hasher/hasher';
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
              data: { files: [], targets: {}, root: '' },
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
        { helperDependencies: ['npm:tslib'] }
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
                files: [
                  {
                    file: 'libs/lib1/src/main.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:typescript',
                        source: 'lib1',
                      },
                    ],
                    hash: '',
                  },
                  {
                    file: 'libs/lib1/src/main2.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'lib2',
                        source: 'lib1',
                      },
                    ],
                    hash: '',
                  },
                  {
                    file: 'libs/lib1/src/main.spec.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:jest',
                        source: 'lib1',
                      },
                    ],
                    hash: '',
                  },
                ],
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
                files: [
                  {
                    file: 'libs/lib2/src/main.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:axios',
                        source: 'lib2',
                      },
                    ],
                    hash: '',
                  },
                  {
                    file: 'libs/lib2/src/main.spec.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:jest',
                        source: 'lib2',
                      },
                    ],
                    hash: '',
                  },
                ],
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
        }
      )
    ).toEqual({
      dependencies: {
        axios: '1.0.0',
        tslib: '2.4.0',
        typescript: '4.8.4',
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
                files: [
                  {
                    file: 'libs/lib1/src/main.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:typescript',
                        source: 'lib1',
                      },
                    ],
                    hash: '',
                  },
                  {
                    file: 'libs/lib1/src/main2.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'lib2',
                        source: 'lib1',
                      },
                    ],
                    hash: '',
                  },
                  {
                    file: 'libs/lib1/src/main.spec.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:jest',
                        source: 'lib1',
                      },
                    ],
                    hash: '',
                  },
                ],
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
                files: [
                  {
                    file: 'libs/lib2/src/main.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:axios',
                        source: 'lib2',
                      },
                    ],
                    hash: '',
                  },
                  {
                    file: 'libs/lib2/src/main.spec.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:jest',
                        source: 'lib2',
                      },
                    ],
                    hash: '',
                  },
                ],
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
        { isProduction: true, helperDependencies: ['npm:tslib'] }
      )
    ).toEqual({
      dependencies: {
        axios: '1.0.0',
        jest: '29.0.0',
        tslib: '2.4.0',
        typescript: '4.8.4',
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
                files: [
                  {
                    file: 'libs/lib1/src/main.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'lib3',
                        source: 'lib1',
                      },
                    ],
                    hash: '',
                  },
                  {
                    file: 'libs/lib1/src/main2.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'lib2',
                        source: 'lib1',
                      },
                    ],
                    hash: '',
                  },
                ],
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
                files: [
                  {
                    file: 'libs/lib2/src/main.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'lib4',
                        source: 'lib2',
                      },
                    ],
                    hash: '',
                  },
                ],
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
                files: [
                  {
                    file: 'libs/lib3/src/main.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'lib4',
                        source: 'lib3',
                      },
                    ],
                    hash: '',
                  },
                ],
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
                files: [
                  {
                    file: 'libs/lib2/src/main.ts',
                    dependencies: [
                      {
                        type: DependencyType.static,
                        target: 'npm:axios',
                        source: 'lib2',
                      },
                    ],
                    hash: '',
                  },
                ],
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
        { isProduction: true }
      )
    ).toEqual({
      dependencies: {
        axios: '1.0.0',
      },
      name: 'lib1',
      version: '0.0.1',
    });

    expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
      1,
      'libs/lib1',
      expect.anything(),
      expect.anything()
    );
    expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
      2,
      'libs/lib3',
      expect.anything(),
      expect.anything()
    );
    expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
      3,
      'libs/lib4',
      expect.anything(),
      expect.anything()
    );
    expect(filterUsingGlobPatternsSpy).toHaveBeenNthCalledWith(
      4,
      'libs/lib2',
      expect.anything(),
      expect.anything()
    );
    expect(filterUsingGlobPatternsSpy).toHaveBeenCalledTimes(4);
  });
});
