import { ExecutorContext, logger } from '@nrwl/devkit';
import { join } from 'path';
import storybookBuilder from './build-storybook.impl';
import * as executorContext from '../../utils/test-configs/executor-context.json';
jest.mock('@storybook/core-server', () => {
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

// TODO(katerina): Update when Storybook 7
describe('Build storybook', () => {
  let context: ExecutorContext;
  let options: CLIOptions & CommonNxStorybookConfig;

  beforeEach(async () => {
    options = {
      configDir: join(__dirname, `/../../utils/test-configs/.storybook`),
      uiFramework: '@storybook/react',
      outputDir: `/root/dist/storybook`,
    };

    context = executorContext as ExecutorContext;
  });

  it('should call the storybook buildStaticStandalone', async () => {
    const loggerSpy = jest.spyOn(logger, 'info');

    const standaloneSpy = jest
      .spyOn(build, 'buildStaticStandalone')
      .mockImplementation(() => Promise.resolve());

    const result = await storybookBuilder(options, context);

    expect(standaloneSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(`NX ui framework: @storybook/react`);
    expect(loggerSpy).toHaveBeenCalledWith(
      `NX Storybook files available in /root/dist/storybook`
    );
    expect(result.success).toBeTruthy();
  });
});
