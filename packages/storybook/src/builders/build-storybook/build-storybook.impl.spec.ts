import { run as storybookBuilder } from './build-storybook.impl';
import { MockBuilderContext, getMockContext } from '../../utils/testing';
import { join } from 'path';
import * as storybook from '@storybook/core/dist/server/build-static';

describe('Build storybook', () => {
  let context: MockBuilderContext;

  beforeEach(async () => {
    context = await getMockContext();
  });

  xit('should call the storybook static standalone build', async () => {
    const storybookSpy = spyOn(
      storybook,
      'buildStaticStandalone'
    ).and.returnValue(Promise.resolve(true));
    await storybookBuilder(
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

    expect(storybookSpy).toHaveBeenCalled();
  });

  xit('should log the output path', async () => {
    const outputPath = `${context.workspaceRoot}/dist/storybook`;
    spyOn(storybook, 'buildStaticStandalone').and.returnValue(
      Promise.resolve(true)
    );
    await storybookBuilder(
      {
        uiFramework: '@storybook/angular',
        outputPath,
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

    expect(
      context.logger.includes(`Storybook files availble in ${outputPath}`)
    ).toBeTruthy();
  });

  xit('should log the choosen ui framework', async () => {
    const uiFramework = '@storybook/angular';
    spyOn(storybook, 'buildStaticStandalone').and.returnValue(
      Promise.resolve(true)
    );
    await storybookBuilder(
      {
        uiFramework,
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

    expect(
      context.logger.includes(`ui framework: ${uiFramework}`)
    ).toBeTruthy();
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
  }, 120000);
});
