import { NxPluginE2EBuilderOptions, runNxPluginE2EBuilder } from './e2e.impl';
import { MockBuilderContext } from '@nrwl/workspace/testing';
import { getMockContext } from '../../utils/testing';
import * as devkitArchitect from '@angular-devkit/architect';
import { of } from 'rxjs';

describe('NxPluginE2EBuilder', () => {
  let testOptions: NxPluginE2EBuilderOptions;
  let context: MockBuilderContext;
  let scheduleTargetAndForgetSpy: jest.SpyInstance;
  let contextBuilderSpy: jest.SpyInstance;
  beforeEach(async () => {
    context = await getMockContext();
    context.addTarget(
      { project: 'plugin-e2e', target: 'build' },
      '@nrwl/nx-plugin:e2e'
    );
    testOptions = {
      jestConfig: 'apps/plugin-e2e/jest.config.js',
      tsSpecConfig: 'apps/plugin-e2e/tsconfig.spec.js',
      target: 'plugin:build'
    };

    scheduleTargetAndForgetSpy = jest
      .spyOn(devkitArchitect, 'scheduleTargetAndForget')
      .mockImplementation((context, options) => {
        debugger;
        return of({ success: true });
      });

    contextBuilderSpy = jest
      .spyOn(context, 'scheduleBuilder')
      .mockImplementation((name, overrides) => {
        console.log('hello');
        return new Promise((res, rej) => {
          res({
            result: of({ success: true }).toPromise(),
            id: 1,
            info: {
              builderName: 'builder',
              description: '',
              optionSchema: {}
            },
            output: of({ success: true }),
            progress: of({} as any),
            stop: jest.fn()
          });
        });
      });
  });

  it('should build the plugin and run the test', async () => {
    await runNxPluginE2EBuilder(testOptions, context).toPromise();
    expect(scheduleTargetAndForgetSpy).toHaveBeenCalledWith(context, {
      project: 'plugin',
      target: 'build'
    });
    expect(contextBuilderSpy).toHaveBeenCalledWith('@nrwl/jest:jest', {
      tsConfig: testOptions.tsSpecConfig,
      jestConfig: testOptions.jestConfig,
      watch: false
    });
  });
});
