import { ExecutorContext, logger } from '@nrwl/devkit';
import { join } from 'path';
import storybookBuilder, {
  StorybookBuilderOptions,
} from './build-storybook.impl';
import * as executorContext from '../../utils/test-configs/executor-context.json';
jest.mock('@storybook/core-server', () => {
  const buildStaticStandalone = jest
    .fn()
    .mockImplementation(() => Promise.resolve());
  return {
    buildStaticStandalone,
  };
});
import * as build from '@storybook/core-server';

describe('Build storybook', () => {
  let context: ExecutorContext;
  let options: StorybookBuilderOptions;
  let uiFramework: StorybookBuilderOptions['uiFramework'];
  let outputPath: StorybookBuilderOptions['outputPath'];
  let config: StorybookBuilderOptions['config'];

  beforeEach(async () => {
    config = {
      pluginPath: join(
        __dirname,
        `/../../utils/test-configs/.storybook/main.js`
      ),
      configFolder: join(__dirname, `/../../utils/test-configs/.storybook`),
      srcRoot: join(
        __dirname,
        `/../../utils/test-configs/.storybook/tsconfig.json`
      ),
    };
    options = {
      config,
      uiFramework: '@storybook/react',
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
    expect(loggerSpy).toHaveBeenCalledWith(
      `NX Storybook files available in ${outputPath}`
    );
    expect(loggerSpy).toHaveBeenCalledWith(`NX ui framework: @storybook/react`);
    expect(result.success).toBeTruthy();
  });
});
