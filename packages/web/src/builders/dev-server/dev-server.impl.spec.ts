import * as normalizeUtils from '../../utils/normalize';
import { WebBuildBuilderOptions } from '../build/build.impl';
import webDevServerImpl, { WebDevServerOptions } from './dev-server.impl';

jest.mock('@nrwl/devkit');
import { readTargetOptions, ExecutorContext } from '@nrwl/devkit';

jest.mock('../../utils/devserver.config', () => ({
  getDevServerConfig: jest.fn().mockReturnValue({}),
}));

describe('Web Server Builder', () => {
  let context: ExecutorContext;
  let options: WebDevServerOptions;

  beforeEach(async () => {
    jest.clearAllMocks();

    context = {
      root: '/root',
      cwd: '/root',
      projectName: 'proj',
      targetName: 'serve',
      workspace: {
        version: 2,
        projects: {
          proj: {
            root: 'proj',
            sourceRoot: 'proj/src',
            targets: {
              serve: {
                executor: '@nrwl/web:dev-server',
                options: {
                  buildTarget: 'proj:build',
                },
              },
              build: {
                executor: 'build',
                options: {},
              },
            },
          },
        },
      },
      isVerbose: false,
    };

    options = {
      buildTarget: 'proj:build',
      port: 4200,
    } as WebDevServerOptions;

    (readTargetOptions as any).mockImplementation(() => {});

    jest
      .spyOn(normalizeUtils, 'normalizeWebBuildOptions')
      .mockReturnValue({} as WebBuildBuilderOptions);
  });

  it('should pass `baseHref` to build', async () => {
    const baseHref = '/my-domain';
    await webDevServerImpl({ ...options, baseHref }, context);

    expect(normalizeUtils.normalizeWebBuildOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        baseHref,
      }),
      '/root',
      'proj/src'
    );
  });
});
