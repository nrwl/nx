import { MockBuilderContext } from '@nrwl/workspace/testing';
import { getMockContext } from '../../utils/testing';
import { EMPTY } from 'rxjs';
import * as normalizeUtils from '../../utils/normalize';
import { WebBuildBuilderOptions } from '../build/build.impl';
import { run, WebDevServerOptions } from './dev-server.impl';

jest.mock('@angular-devkit/build-webpack', () => ({
  runWebpackDevServer: () => EMPTY,
}));

jest.mock('../../utils/devserver.config', () => ({
  getDevServerConfig: jest.fn().mockReturnValue({}),
}));

describe('Web Server Builder', () => {
  let context: MockBuilderContext;
  let options: WebDevServerOptions;

  beforeEach(async () => {
    jest.clearAllMocks();

    context = await getMockContext();
    context.getProjectMetadata = jest
      .fn()
      .mockReturnValue({ sourceRoot: '/root/app/src' });

    context.getTargetOptions = jest.fn().mockReturnValue({});

    options = {
      buildTarget: 'app:build',
      port: 4200,
    } as WebDevServerOptions;

    jest
      .spyOn(normalizeUtils, 'normalizeWebBuildOptions')
      .mockReturnValue({} as WebBuildBuilderOptions);
  });

  it('should pass `baseHref` to build', async () => {
    const baseHref = '/my-domain';
    await run({ ...options, baseHref }, context).toPromise();

    expect(normalizeUtils.normalizeWebBuildOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        baseHref,
      }),
      '/root',
      '/root/app/src'
    );
  });
});
