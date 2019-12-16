import { run as storybookBuilder } from './build-storybook.impl';
import { MockBuilderContext, getMockContext } from '../../utils/testing';
import { join } from 'path';

describe('Build storybook', () => {
  let context: MockBuilderContext;

  beforeEach(async () => {
    context = await getMockContext();
  });

  it('should run successfull', async () => {
    const result = await storybookBuilder(
      {
        uiFramework: '@storybook/angular',
        outputPath: `${context.workspaceRoot}/dist/storybook`,
        config: {
          pluginPath: join(
            __dirname,
            `/../../schematics/configuration/root-files/.storybook/addons.js`
          ),
          configPath: join(
            __dirname,
            `/../../schematics/configuration/root-files/.storybook/webpack.config.js`
          ),
          srcRoot: join(
            __dirname,
            `/../../schematics/configuration/root-files/.storybook/tsconfig.json`
          )
        }
      },
      context
    ).toPromise();

    expect(result.success).toBe(true);
  }, 20000);
});
