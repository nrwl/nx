jest.mock('fs');
jest.mock('@nrwl/workspace/src/core/project-graph');
jest.mock('@nrwl/workspace');
jest.mock('nx/src/shared/workspace');
import * as graph from '@nrwl/workspace/src/core/project-graph';
import * as workspace from '@nrwl/workspace';
import * as taoWorkspace from 'nx/src/shared/workspace';
import * as fs from 'fs';

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
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        dependencies: {
          '@angular/core': '~13.2.0',
        },
      })
    );

    (workspace.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
        },
      },
    });

    (taoWorkspace.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
        },
      }),
    });

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
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        dependencies: {
          '@angular/core': '~13.2.0',
        },
      })
    );

    (workspace.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
        },
      },
    });

    (taoWorkspace.Workspaces as jest.Mock).mockReturnValue({
      readWorkspaceConfiguration: () => ({
        projects: {
          shared: {
            sourceRoot: '/libs/shared/src/',
          },
        },
      }),
    });

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
        core: [{ target: 'shared' }],
      },
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        dependencies: {
          '@angular/core': '~13.2.0',
        },
      })
    );

    (workspace.readTsConfig as jest.Mock).mockReturnValue({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
          core: ['/libs/core/src/index.ts'],
        },
      },
    });

    (taoWorkspace.Workspaces as jest.Mock).mockReturnValue({
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
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        dependencies: {
          '@angular/core': '~13.2.0',
        },
      })
    );

    (workspace.readTsConfig as jest.Mock).mockImplementation(() => ({
      options: {
        paths: {
          shared: ['/libs/shared/src/index.ts'],
          '@myorg/core': ['/libs/core/src/index.ts'],
        },
      },
    }));

    (taoWorkspace.Workspaces as jest.Mock).mockReturnValue({
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
});
