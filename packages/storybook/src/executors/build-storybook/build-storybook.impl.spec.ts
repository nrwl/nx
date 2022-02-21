import { ExecutorContext, logger } from '@nrwl/devkit';

import { join } from 'path';
jest.mock('@storybook/core/standalone', () =>
  jest.fn().mockImplementation(() => Promise.resolve())
);
import * as storybook from '@storybook/core/standalone';
import storybookBuilder, {
  StorybookBuilderOptions,
} from './build-storybook.impl';
import * as fileUtils from '@nrwl/workspace/src/core/file-utils';

describe('Build storybook', () => {
  let context: ExecutorContext;
  let options: StorybookBuilderOptions;
  let uiFramework: StorybookBuilderOptions['uiFramework'];
  let outputPath: StorybookBuilderOptions['outputPath'];
  let config: StorybookBuilderOptions['config'];

  beforeEach(async () => {
    jest.spyOn(fileUtils, 'readPackageJson').mockReturnValue({
      devDependencies: {
        '@storybook/addon-essentials': '~6.2.9',
        '@storybook/angular': '~6.2.9',
      },
    });
    uiFramework = '@storybook/angular';
    outputPath = '/root/dist/storybook';
    config = {
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
    options = {
      uiFramework,
      outputPath,
      projectBuildConfig: 'proj',
      stylePreprocessorOptions: {
        includePaths: ['my-path/my-style-options'],
      },
      styles: ['my-other-path/my-other-styles.scss'],
      config,
    };

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
            targets: {
              build: {
                executor: '@angular-devkit/build-angular:browser',
                options: {
                  main: 'apps/proj/src/main.ts',
                  outputPath: 'dist/apps/proj',
                  tsConfig: 'apps/proj/tsconfig.app.json',
                  index: 'apps/proj/src/index.html',
                },
              },
              storybook: {
                executor: '@nrwl/storybook:build-storybook',
                options,
              },
            },
          },
        },
        defaultProject: 'proj',
        npmScope: 'test',
      },
      isVerbose: false,
    };
  });

  it('should call the storybook static standalone build', async () => {
    jest.spyOn(logger, 'info');

    const result = await storybookBuilder(options, context);

    expect(storybook).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      `NX Storybook files available in ${outputPath}`
    );

    expect(logger.info).toHaveBeenCalledWith(`NX ui framework: ${uiFramework}`);
    expect(result.success).toBeTruthy();
  });
});
