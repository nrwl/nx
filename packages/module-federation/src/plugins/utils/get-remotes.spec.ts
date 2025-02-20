import { ProjectGraph } from '@nx/devkit';
import { getRemotes } from './get-remotes';
import * as _config_1 from '../../utils';
import * as fs from 'fs';

jest.mock('../../utils');

describe('getRemotes', () => {
  const mfConfig = {
    name: 'my-app',
    exposes: {
      './my-app': './src/app/index.ts',
    },
    remotes: ['my-app-remote1', 'my-app-remote2'],
  };

  const remote1Config = {
    name: 'my-app-remote1',
    exposes: {
      './my-app-remote1': './src/remote-entry.ts',
    },
  };

  const remote2Config = {
    name: 'my-app-remote2',
    exposes: {
      './my-app-remote2': './src/remote-entry.ts',
    },
  };

  const projectGraph: ProjectGraph = {
    nodes: {
      'my-app-remote1': {
        type: 'app',
        name: 'my-app-remote-1',
        data: {
          root: 'my-app-remote1',
          sourceRoot: 'my-app-remote1/src',
          targets: {
            serve: {
              options: {
                port: 4201,
              },
            },
          },
        },
      },
      'my-app-remote2': {
        type: 'app',
        name: 'my-app-remote-2',
        data: {
          root: 'my-app-remote2',
          sourceRoot: 'my-app-remote2/src',
          targets: {
            serve: {
              options: {
                port: 4202,
              },
            },
          },
        },
      },
      'my-app': {
        type: 'app',
        name: 'my-app',
        data: {
          root: 'my-app',
          sourceRoot: 'my-app/src',
          targets: {
            serve: {
              options: {
                port: 4200,
              },
            },
          },
        },
      },
    },
    dependencies: {},
  };

  it('should return remotes', () => {
    // ARRANGE
    const mfConfigSpy = jest
      .spyOn(_config_1, 'getModuleFederationConfig')
      .mockImplementation((tsConfig, workspaceRoot, projectRoot) => {
        if (projectRoot === 'my-app') {
          return mfConfig;
        } else if (projectRoot === 'my-app-remote1') {
          return remote1Config;
        } else if (projectRoot === 'my-app-remote2') {
          return remote2Config;
        }
      });
    const fsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    // ACT
    const remotes = getRemotes(mfConfig, projectGraph);

    // ASSERT
    expect(remotes.remotes).toEqual(['my-app-remote1', 'my-app-remote2']);
    expect(remotes.staticRemotePort).toEqual(4203);
  });
});
