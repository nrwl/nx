import { ExecutorContext, logger } from '@nrwl/devkit';

import { join } from 'path';
jest.mock('@storybook/core/standalone', () =>
  jest.fn().mockImplementation(() => Promise.resolve())
);
import * as storybook from '@storybook/core/standalone';
import storybookBuilder from './build-storybook.impl';
import * as fileUtils from '@nrwl/workspace/src/core/file-utils';

describe('Build storybook', () => {
  let context: ExecutorContext;

  beforeEach(async () => {
    jest.spyOn(fileUtils, 'readPackageJson').mockReturnValue({
      devDependencies: {
        '@storybook/addon-essentials': '~6.2.9',
        '@storybook/angular': '~6.2.9',
      },
    });

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
      nxJson: {
        npmScope: 'test',
      },
      isVerbose: false,
    };
  });

  it('should call the storybook static standalone build', async () => {
    jest.spyOn(logger, 'info');
    const uiFramework = '@storybook/angular';
    const outputPath = `${context.root}/dist/storybook`;
    const config = {
      pluginPath: join(
        __dirname,
        `/../../generators/configuration/root-files/.storybook/main.js`
      ),
      configFolder: join(
        __dirname,
        `/../../generators/configuration/root-files/.storybook`
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
