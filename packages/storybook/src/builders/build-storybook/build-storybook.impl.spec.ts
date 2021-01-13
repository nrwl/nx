import { join } from 'path';
import * as storybook from '@storybook/core/dist/server/build-static';
import { MockBuilderContext } from '@nrwl/workspace/testing';
import { getMockContext } from '../../utils/testing';
import { run as storybookBuilder } from './build-storybook.impl';

jest.mock('@nrwl/workspace/src/core/project-graph');
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';

describe('Build storybook', () => {
  let context: MockBuilderContext;
  let mockCreateProjectGraph: jest.Mock<
    ReturnType<typeof createProjectGraph>
  > = createProjectGraph as any;

  beforeEach(async () => {
    context = await getMockContext();
    context.target = {
      project: 'testui',
      target: 'build',
    };

    mockCreateProjectGraph.mockReturnValue({
      nodes: {
        testui: {
          name: 'testui',
          type: 'lib',
          data: null,
        },
      },
      dependencies: null,
    });
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
            `/../../schematics/configuration/root-files/.storybook/main.js`
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
      context.logger.includes(`Storybook files available in ${outputPath}`)
    ).toBeTruthy();
    expect(
      context.logger.includes(`ui framework: ${uiFramework}`)
    ).toBeTruthy();
    expect(result.success).toBeTruthy();
  });
});
