import { join } from 'path';

import * as storybook from '@storybook/core/dist/server/build-static';

import { MockBuilderContext } from '@nrwl/workspace/testing';

import { getMockContext } from '../../utils/testing';
import { run as storybookBuilder } from './build-storybook.impl';

describe('Build storybook', () => {
  let context: MockBuilderContext;

  beforeEach(async () => {
    context = await getMockContext();
  });

  it('should call the storybook static standalone build', async () => {
    const uiFramework = '@storybook/angular';
    const outputPath = `${context.workspaceRoot}/dist/storybook`;
    const storybookSpy = spyOn(
      storybook,
      'buildStaticStandalone'
    ).and.returnValue(Promise.resolve(true));
    const result = await storybookBuilder(
      {
        uiFramework: uiFramework,
        outputPath: outputPath,
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
          ),
        },
      },
      context
    ).toPromise();

    expect(storybookSpy).toHaveBeenCalled();
    expect(
      context.logger.includes(`Storybook files availble in ${outputPath}`)
    ).toBeTruthy();
    expect(
      context.logger.includes(`ui framework: ${uiFramework}`)
    ).toBeTruthy();
    expect(result.success).toBeTruthy();
  });
});
