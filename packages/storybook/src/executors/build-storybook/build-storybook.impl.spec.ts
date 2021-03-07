import { ExecutorContext, logger } from '@nrwl/devkit';

import { join } from 'path';
jest.mock('@storybook/core/standalone', () =>
  jest.fn().mockImplementation(() => Promise.resolve())
);
import * as storybook from '@storybook/core/standalone';
import storybookBuilder from './build-storybook.impl';

import angularStorybookOptions from '@storybook/angular/dist/server/options';

describe('Build storybook', () => {
  let context: ExecutorContext;

  beforeEach(async () => {
    context = {
      root: '/root',
      cwd: '/root',
      projectName: 'proj',
      targetName: 'storybook',
      workspace: {
        version: 2,
        projects: {
          proj: {
            root: '',
            sourceRoot: 'src',
            targets: {},
          },
        },
      },
      isVerbose: false,
    };
  });

  it('should call the storybook static standalone build', async () => {
    spyOn(logger, 'info');
    const uiFramework = '@storybook/angular';
    const outputPath = `${context.root}/dist/storybook`;
    const config = {
      pluginPath: join(
        __dirname,
        `/../../generators/configuration/root-files/.storybook/main.js`
      ),
      configPath: join(
        __dirname,
        `/../../generators/configuration/root-files/.storybook/webpack.config.js`
      ),
      srcRoot: join(
        __dirname,
        `/../../generators/configuration/root-files/.storybook/tsconfig.json`
      ),
    };

    const result = await storybookBuilder(
      {
        uiFramework,
        outputPath,
        config,
      },
      context
    );

    expect(storybook).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      `NX Storybook files available in ${outputPath}`
    );

    expect(logger.info).toHaveBeenCalledWith(`NX ui framework: ${uiFramework}`);
    expect(result.success).toBeTruthy();
  });
});
