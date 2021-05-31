import { fs, vol } from 'memfs';

import { ExecutorContext } from '@nrwl/devkit';

jest.mock('@storybook/core/server', () => ({
  buildDevStandalone: jest.fn().mockImplementation(() => Promise.resolve()),
}));
import { buildDevStandalone } from '@storybook/core/server';
import * as fileUtils from '@nrwl/workspace/src/core/file-utils';

import storybookExecutor, { StorybookExecutorOptions } from './storybook.impl';
import { join } from 'path';
import { readFileSync } from 'fs-extra';

describe('@nrwl/storybook:storybook', () => {
  let context: ExecutorContext;
  let options: StorybookExecutorOptions;
  beforeEach(() => {
    jest.spyOn(fileUtils, 'readPackageJson').mockReturnValue({
      devDependencies: {
        '@storybook/addon-essentials': '^6.2.7',
        '@storybook/angular': '^6.2.7',
      },
    });

    options = {
      uiFramework: '@storybook/angular',
      port: 4400,
      config: {
        configFolder: `/root/.storybook`,
      },
    };
    // preserve original package.json file to memory
    const packageJsonPath = join(
      __dirname,
      `../../../../../node_modules/@storybook/angular/package.json`
    );
    vol.fromJSON({
      [packageJsonPath]: readFileSync(packageJsonPath).toString(),
    });
    vol.mkdirSync('/root/.storybook', {
      recursive: true,
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
      isVerbose: false,
    };
  });

  it('should provide options to storybook', async () => {
    jest.mock('fs', () => fs);
    const iterator = storybookExecutor(options, context);
    const { value } = await iterator.next();
    expect(value).toEqual({ success: true });
    expect(buildDevStandalone).toHaveBeenCalled();
  });
});
