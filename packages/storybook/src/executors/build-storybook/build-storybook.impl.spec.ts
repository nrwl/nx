import { ExecutorContext, logger } from '@nrwl/devkit';
import { join } from 'path';
jest.mock('@storybook/core/standalone', () =>
  jest.fn().mockImplementation(() => Promise.resolve())
);
import * as storybook from '@storybook/core/standalone';
import storybookBuilder, {
  StorybookBuilderOptions,
} from './build-storybook.impl';

describe('Build storybook', () => {
  let context: ExecutorContext;
  let options: StorybookBuilderOptions;
  let uiFramework: StorybookBuilderOptions['uiFramework'];
  let outputPath: StorybookBuilderOptions['outputPath'];
  let config: StorybookBuilderOptions['config'];

  beforeEach(async () => {
    uiFramework = '@storybook/react';
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
                executor: '@nrwl/web:webpack',
                options: {
                  compiler: 'babel',
                  outputPath: 'dist/apps/webre',
                  index: 'apps/webre/src/index.html',
                  baseHref: '/',
                  main: 'apps/webre/src/main.tsx',
                  polyfills: 'apps/webre/src/polyfills.ts',
                  tsConfig: 'apps/webre/tsconfig.app.json',
                  assets: [
                    'apps/webre/src/favicon.ico',
                    'apps/webre/src/assets',
                  ],
                  styles: ['apps/webre/src/styles.css'],
                  scripts: [],
                  webpackConfig: '@nrwl/react/plugins/webpack',
                },
              },
              storybook: {
                executor: '@nrwl/storybook:build-storybook',
                options,
              },
            },
          },
        },
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
