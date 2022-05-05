jest.mock('fs');
jest.mock('@nrwl/devkit');
jest.mock('@nrwl/workspace/src/utilities/typescript');
jest.mock('nx/src/project-graph/file-utils');
import * as graph from '@nrwl/devkit';
import * as typescriptUtils from '@nrwl/workspace/src/utilities/typescript';
import * as workspace from 'nx/src/project-graph/file-utils';
import * as fs from 'fs';
import * as devkit from '@nrwl/devkit';

import { withModuleFederation } from './with-module-federation';

describe('withModuleFederation', () => {
  afterEach(() => jest.clearAllMocks());

  it('should create a host config correctly', async () => {
    // ARRANGE
    (graph.readCachedProjectGraph as jest.Mock).mockReturnValue({
      dependencies: {
        host: [
          { target: 'npm:@angular/core' },
          { target: 'npm:zone.js' },
          { target: 'shared' },
        ],
      },
    });

    (workspace.readWorkspaceJson as jest.Mock).mockReturnValue({
      projects: {
        remote1: {
          targets: {
            serve: {
              options: {
                publicHost: 'http://localhost:4201',
              },
            },
          },
        },
      },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    jest.spyOn(devkit, 'readJsonFile').mockImplementation(() => ({
      dependencies: { '@angular/core': '~13.2.0' },
    }));

    (typescriptUtils.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
        },
      },
    });

    (graph.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
        },
      }),
    });

    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // ACT
    const config = (
      await withModuleFederation({
        name: 'host',
        remotes: ['remote1'],
      })
    )({});

    // ASSERT
    expect(config.plugins).toMatchSnapshot();
  });

  it('should create a remote config correctly', async () => {
    // ARRANGE
    (graph.readCachedProjectGraph as jest.Mock).mockReturnValue({
      dependencies: {
        remote1: [
          { target: 'npm:@angular/core' },
          { target: 'npm:zone.js' },
          { target: 'shared' },
        ],
      },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    jest.spyOn(devkit, 'readJsonFile').mockImplementation(() => ({
      dependencies: { '@angular/core': '~13.2.0' },
    }));

    (typescriptUtils.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
        },
      },
    });

    (graph.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
        },
      }),
    });

    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // ACT
    const config = (
      await withModuleFederation({
        name: 'remote1',
        exposes: { './Module': 'apps/remote1/src/module.ts' },
      })
    )({});

    // ASSERT
    expect(config.plugins).toMatchSnapshot();
  });

  it('should collect dependencies correctly', async () => {
    // ARRANGE
    (graph.readCachedProjectGraph as jest.Mock).mockReturnValue({
      dependencies: {
        remote1: [
          { target: 'npm:@angular/core' },
          { target: 'npm:zone.js' },
          { target: 'core' },
        ],
        core: [{ target: 'shared' }, { target: 'npm:lodash' }],
      },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    jest.spyOn(devkit, 'readJsonFile').mockImplementation(() => ({
      dependencies: { '@angular/core': '~13.2.0', lodash: '~4.17.20' },
    }));

    (typescriptUtils.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
          core: ['/libs/core/src/index.ts'],
        },
      },
    });

    (graph.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
          core: {
            sourceRoot: '/libs/core/src/',
          },
        },
      }),
    });

    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // ACT
    const config = (
      await withModuleFederation({
        name: 'remote1',
        exposes: { './Module': 'apps/remote1/src/module.ts' },
      })
    )({});

    // ASSERT
    expect(config.plugins).toMatchSnapshot();
  });

  it('should not have duplicated entries for duplicated dependencies', async () => {
    // ARRANGE
    (graph.readCachedProjectGraph as jest.Mock).mockReturnValue({
      dependencies: {
        remote1: [
          { target: 'npm:@angular/core' },
          { target: 'npm:zone.js' },
          { target: 'core' },
        ],
        core: [{ target: 'shared' }, { target: 'npm:@angular/core' }],
      },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    jest.spyOn(devkit, 'readJsonFile').mockImplementation(() => ({
      dependencies: { '@angular/core': '~13.2.0' },
    }));

    (typescriptUtils.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
          core: ['/libs/core/src/index.ts'],
        },
      },
    });

    (graph.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
          core: {
            sourceRoot: '/libs/core/src/',
          },
        },
      }),
    });

    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // ACT
    const config = (
      await withModuleFederation({
        name: 'remote1',
        exposes: { './Module': 'apps/remote1/src/module.ts' },
      })
    )({});

    // ASSERT
    expect(config.plugins).toMatchSnapshot();
  });

  it('should map dependencies from project name to import name', async () => {
    // ARRANGE
    (graph.readCachedProjectGraph as jest.Mock).mockReturnValue({
      dependencies: {
        remote1: [
          { target: 'npm:@angular/core' },
          { target: 'npm:zone.js' },
          { target: 'core' },
        ],
        core: [{ target: 'shared' }],
      },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    jest.spyOn(devkit, 'readJsonFile').mockImplementation(() => ({
      dependencies: { '@angular/core': '~13.2.0' },
    }));

    (typescriptUtils.readTsConfig as jest.Mock).mockImplementation(() => ({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
          '@myorg/core': ['/libs/core/src/index.ts'],
        },
      },
    }));

    (graph.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
          core: {
            sourceRoot: '/libs/core/src/',
          },
        },
      }),
    });

    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // ACT
    const config = (
      await withModuleFederation({
        name: 'remote1',
        exposes: { './Module': 'apps/remote1/src/module.ts' },
      })
    )({});

    // ASSERT
    expect(config.plugins).toMatchSnapshot();
  });

  it('should apply the user-specified shared function correctly', async () => {
    // ARRANGE
    (graph.readCachedProjectGraph as jest.Mock).mockReturnValue({
      dependencies: {
        remote1: [
          { target: 'npm:@angular/core' },
          { target: 'npm:zone.js' },
          { target: 'core' },
        ],
        core: [{ target: 'shared' }, { target: 'npm:@angular/core' }],
      },
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    jest.spyOn(devkit, 'readJsonFile').mockImplementation(() => ({
      dependencies: { '@angular/core': '~13.2.0' },
    }));
    (typescriptUtils.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
          core: ['/libs/core/src/index.ts'],
        },
      },
    });
    (graph.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
          core: {
            sourceRoot: '/libs/core/src/',
          },
        },
      }),
    });
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // ACT
    const config = (
      await withModuleFederation({
        name: 'remote1',
        exposes: { './Module': 'apps/remote1/src/module.ts' },
        shared: (dep, config) => {
          if (dep === 'core') {
            return false;
          }
          if (dep === '@angular/core') {
            return {
              ...config,
              strictVersion: false,
              requiredVersion: undefined,
            };
          }
        },
      })
    )({});

    // ASSERT
    expect(config.plugins).toMatchSnapshot();
  });

  it('should apply additional shared dependencies when specified', async () => {
    // ARRANGE
    (graph.readCachedProjectGraph as jest.Mock).mockReturnValue({
      dependencies: {
        remote1: [{ target: 'npm:@angular/core' }, { target: 'core' }],
        core: [{ target: 'npm:@angular/core' }],
      },
      nodes: { shared: {} },
      externalNodes: { '@angular/common': {} },
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    jest.spyOn(devkit, 'readJsonFile').mockImplementation(() => ({
      dependencies: {
        '@angular/core': '~13.2.0',
        '@angular/common': '~13.2.0',
        '@angular/router': '~13.2.0',
      },
    }));
    (typescriptUtils.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
          core: ['/libs/core/src/index.ts'],
        },
      },
    });
    (graph.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
          core: {
            sourceRoot: '/libs/core/src/',
          },
        },
      }),
    });
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // ACT
    const config = (
      await withModuleFederation({
        name: 'remote1',
        exposes: { './Module': 'apps/remote1/src/module.ts' },
        shared: (dep, config) => {
          if (dep === 'core') {
            return false;
          }
        },
        additionalShared: [
          '@angular/common',
          [
            '@angular/core',
            {
              strictVersion: false,
              singleton: true,
            },
          ],
          {
            libraryName: '@angular/router',
            sharedConfig: {
              requiredVersion: '^13.0.0',
              singleton: false,
              strictVersion: true,
            },
          },
          'shared',
        ],
      })
    )({});

    // ASSERT
    expect(config.plugins).toMatchSnapshot();
  });

  it('should throw when an additionalShared entry is a string and it is not in the project graph', async () => {
    // ARRANGE
    (graph.readCachedProjectGraph as jest.Mock).mockReturnValue({
      dependencies: {
        remote1: [{ target: 'npm:@angular/core' }, { target: 'core' }],
        core: [{ target: 'npm:@angular/core' }],
      },
      nodes: {},
      externalNodes: {},
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    jest.spyOn(devkit, 'readJsonFile').mockImplementation(() => ({
      dependencies: { '@angular/core': '~13.2.0' },
    }));
    (typescriptUtils.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
          core: ['/libs/core/src/index.ts'],
        },
      },
    });
    (graph.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
          core: {
            sourceRoot: '/libs/core/src/',
          },
        },
      }),
    });
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    // ACT & ASSERT
    await expect(
      withModuleFederation({
        name: 'remote1',
        exposes: { './Module': 'apps/remote1/src/module.ts' },
        additionalShared: ['shared'],
      })
    ).rejects.toThrow(
      'The specified dependency "shared" in the additionalShared configuration does not exist in the project graph.'
    );
  });
});
