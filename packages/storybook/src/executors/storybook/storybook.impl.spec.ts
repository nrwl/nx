import { ExecutorContext } from '@nrwl/devkit';

jest.mock('@storybook/core/server', () => ({
  buildDevStandalone: jest.fn().mockImplementation(() => Promise.resolve()),
}));
import { buildDevStandalone } from '@storybook/core/server';

import { vol } from 'memfs';
jest.mock('fs', () => require('memfs').fs);

import storybookExecutor, { StorybookExecutorOptions } from './storybook.impl';

describe('@nrwl/storybook:storybook', () => {
  let context: ExecutorContext;
  let options: StorybookExecutorOptions;
  beforeEach(() => {
    options = {
      uiFramework: '@storybook/angular',
      port: 4400,
      config: {
        configFolder: `/root/.storybook`,
      },
    };
    vol.fromJSON({});
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
    const iterator = storybookExecutor(options, context);
    const { value } = await iterator.next();
    expect(value).toEqual({ success: true });
    expect(buildDevStandalone).toHaveBeenCalled();
  });
});
