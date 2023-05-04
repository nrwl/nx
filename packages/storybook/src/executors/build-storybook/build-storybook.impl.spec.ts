import { ExecutorContext, logger } from '@nx/devkit';
import { join } from 'path';
import storybookBuilder from './build-storybook.impl';
import * as executorContext from '../../utils/test-configs/executor-context.json';
jest.mock('@storybook/core-server', () => {
  // TODO(katerina): Fix when Nx17
  const buildStaticStandalone = jest
    .fn()
    .mockImplementation(() => Promise.resolve());
  const build = jest.fn().mockImplementation(() => Promise.resolve());
  return {
    buildStaticStandalone,
    build,
  };
});
import * as build from '@storybook/core-server';
import { CLIOptions } from '@storybook/types';
import { CommonNxStorybookConfig } from '../../utils/models';

describe('Build storybook', () => {
  let context: ExecutorContext;
  let options: CLIOptions & CommonNxStorybookConfig;

  beforeEach(async () => {
    options = {
      configDir: join(__dirname, `/../../utils/test-configs/.storybook`),
      outputDir: `/root/dist/storybook`,
    };

    context = executorContext as ExecutorContext;
  });

  it('should call the storybook build', async () => {
    const loggerSpy = jest.spyOn(logger, 'info');

    const buildSpy = jest
      .spyOn(build, 'build')
      .mockImplementation(() => Promise.resolve());

    const result = await storybookBuilder(options, context);

    expect(buildSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenNthCalledWith(
      1,
      'NX Storybook builder starting ...'
    );
    expect(loggerSpy).toHaveBeenNthCalledWith(
      2,
      'NX Storybook builder finished ...'
    );
    expect(loggerSpy).toHaveBeenNthCalledWith(
      3,
      'NX Storybook files available in /root/dist/storybook'
    );

    expect(result.success).toBeTruthy();
  });
});
