import { ExecutorContext } from '@nx/devkit';

jest.mock('@storybook/core-server', () => ({
  // TODO(katerina): Fix when Nx17
  buildDev: jest.fn().mockImplementation(() => Promise.resolve()),
  build: jest.fn().mockImplementation(() =>
    Promise.resolve({
      port: 4400,
    })
  ),
}));
import { build } from '@storybook/core-server';

import storybookExecutor from './storybook.impl';
import { join } from 'path';
import { CLIOptions } from '@storybook/types';
import { CommonNxStorybookConfig } from '../../utils/models';

describe('@nx/storybook:storybook', () => {
  let context: ExecutorContext;
  let options: CLIOptions & CommonNxStorybookConfig;
  beforeEach(() => {
    const rootPath = join(__dirname, `../../../../../`);

    options = {
      port: 4400,
      configDir: join(__dirname, `/../../utils/test-configs/.storybook`),
    };

    context = {
      root: rootPath,
      cwd: rootPath,
      projectName: 'proj',
      targetName: 'storybook',
      projectsConfigurations: {
        version: 2,
        projects: {
          proj: {
            root: '',
            sourceRoot: 'src',
            targets: {
              build: {
                executor: '@nx/web:webpack',
                options: {},
              },
              storybook: {
                executor: '@nx/storybook:storybook',
                options,
              },
            },
          },
        },
      },
      nxJsonConfiguration: {},
      isVerbose: false,
    };
  });

  it('should provide options to storybook', async () => {
    const iterator = storybookExecutor(options, context);
    const { value } = await iterator.next();
    expect(value).toEqual({
      success: true,
      info: {
        baseUrl: 'http://localhost:4400',
        port: 4400,
      },
    });
    expect(build).toHaveBeenCalled();
  });
});
