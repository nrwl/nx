import { parseRemotesConfig } from './parse-remotes-config';
import { ProjectGraph } from '@nx/devkit';

describe('parseRemotesConfig', () => {
  it('should parse remotes config', () => {
    // ARRANGE
    const remotes = ['my-app-remote1', 'my-app-remote2'];
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
      },
      dependencies: {},
    };

    // ACT
    const parsedRemotesConfig = parseRemotesConfig(remotes, '', projectGraph);

    // ASSERT
    expect(parsedRemotesConfig).toEqual({
      config: {
        'my-app-remote1': {
          basePath: 'my-app-remote1',
          outputPath: 'my-app-remote1/dist',
          urlSegment: 'my-app-remote1',
          port: 4201,
        },
        'my-app-remote2': {
          basePath: 'my-app-remote2',
          outputPath: 'my-app-remote2/dist',
          urlSegment: 'my-app-remote2',
          port: 4202,
        },
      },
      remotes: ['my-app-remote1', 'my-app-remote2'],
    });
  });
});
