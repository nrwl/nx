import { webpack } from './index';
import { join } from 'path';
import { readJsonFile, writeJsonFile } from '@nrwl/tao/src/utils/fileutils';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
jest.mock('@nrwl/web/src/utils/web.config', () => {
  return {
    getStylesPartial: () => ({}),
  };
});

describe('Storybook webpack config', () => {
  it('should skip type checking', async () => {
    // package.json does not exist in appRootPath when running tests in CI
    if (process.env.CI) {
      writeJsonFile(join(appRootPath, 'package.json'), {});
    }

    const config = await webpack(
      {
        resolve: {
          plugins: [],
        },
        plugins: [],
        module: {
          rules: [],
        },
      },
      {
        configDir: join(__dirname, '../..'),
      }
    );

    expect(
      config.plugins.find(
        (p) => p.constructor.name === 'ForkTsCheckerWebpackPlugin'
      )
    ).toBeFalsy();
  });
});
