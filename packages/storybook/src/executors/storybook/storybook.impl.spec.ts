import { fs as fsMock, vol } from 'memfs';
import * as fs from 'fs';

import { ExecutorContext } from '@nrwl/devkit';

jest.mock('@storybook/core/server', () => ({
  buildDevStandalone: jest.fn().mockImplementation(() => Promise.resolve()),
}));
import { buildDevStandalone } from '@storybook/core/server';

import storybookExecutor, { StorybookExecutorOptions } from './storybook.impl';
import { join } from 'path';
import { readFileSync } from 'fs-extra';

describe('@nrwl/storybook:storybook', () => {
  let context: ExecutorContext;
  let options: StorybookExecutorOptions;
  beforeEach(() => {
    // preserve original package.json file to memory
    const rootPath = join(__dirname, `../../../../../`);
    const packageJsonPath = join(
      rootPath,
      `node_modules/@storybook/angular/package.json`
    );
    const storybookPath = join(rootPath, '.storybook');

    options = {
      uiFramework: '@storybook/angular',
      port: 4400,
      projectBuildConfig: 'proj',
      config: {
        configFolder: storybookPath,
      },
    };
    vol.fromJSON({
      [packageJsonPath]: readFileSync(packageJsonPath).toString(),
    });
    vol.mkdirSync(storybookPath, {
      recursive: true,
    });
    context = {
      root: rootPath,
      cwd: rootPath,
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
                executor: '@nrwl/storybook:storybook',
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
    jest.mock('fs', () => fsMock);
    jest.spyOn(fs, 'statSync').mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);
  });

  it('should provide options to storybook', async () => {
    const iterator = storybookExecutor(options, context);
    const { value } = await iterator.next();
    expect(value).toEqual({ success: true });
    expect(buildDevStandalone).toHaveBeenCalled();
  });
});
