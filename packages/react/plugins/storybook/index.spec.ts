import { webpack } from './index';
import { join } from 'path';

jest.mock('@nrwl/web/src/utils/web.config', () => {
  return {
    getStylesPartial: () => ({}),
  };
});

describe('Storybook webpack config', () => {
  it('should skip type checking', async () => {
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
