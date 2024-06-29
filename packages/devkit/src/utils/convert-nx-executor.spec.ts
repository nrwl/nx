import { TempFs } from '../../internal-testing-utils';
import { convertNxExecutor } from './convert-nx-executor';

describe('Convert Nx Executor', () => {
  let fs: TempFs;

  beforeAll(async () => {
    fs = new TempFs('convert-nx-executor');
    // The tests in this file don't actually care about the files in the temp dir.
    // The converted executor reads project configuration from the workspace root,
    // which is set to the temp dir in the tests. If there are no files in the temp
    // dir, the glob search currently hangs. So we create a dummy file to prevent that.
    await fs.createFile('blah.json', JSON.stringify({}));
  });

  afterAll(() => {
    fs.cleanup();
  });

  it('should convertNxExecutor to builder correctly and produce the same output', async () => {
    // ARRANGE
    const { schema } = require('@angular-devkit/core');
    const {
      TestingArchitectHost,
      // nx-ignore-next-line
    } =
      require('@angular-devkit/architect/testing') as typeof import('@angular-devkit/architect/testing');
    const { Architect } = require('@angular-devkit/architect');

    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    const testArchitectHost = new TestingArchitectHost();
    testArchitectHost.workspaceRoot = fs.tempDir;
    const architect = new Architect(testArchitectHost, registry);

    const convertedExecutor = convertNxExecutor(echoExecutor);
    const realBuilder = require('@angular-devkit/architect').createBuilder(
      echo
    );

    testArchitectHost.addBuilder('nx:test', convertedExecutor);
    testArchitectHost.addBuilder('ng:test', realBuilder);

    const consoleSpy = jest.spyOn(console, 'log');

    // ACT
    const convertedRun = await architect.scheduleBuilder('nx:test', {
      name: 'test',
    });
    const realRun = await architect.scheduleBuilder('ng:test', {
      name: 'test',
    });

    const convertedRunResult = await convertedRun.result;
    const realRunResult = await realRun.result;

    // ASSERT
    expect(convertedRunResult).toMatchInlineSnapshot(`
      {
        "error": undefined,
        "info": {
          "builderName": "nx:test",
          "description": "Testing only builder.",
          "optionSchema": {
            "type": "object",
          },
        },
        "success": true,
        "target": {
          "configuration": undefined,
          "project": undefined,
          "target": undefined,
        },
      }
    `);
    expect(realRunResult).toMatchInlineSnapshot(`
      {
        "error": undefined,
        "info": {
          "builderName": "ng:test",
          "description": "Testing only builder.",
          "optionSchema": {
            "type": "object",
          },
        },
        "success": true,
        "target": {
          "configuration": undefined,
          "project": undefined,
          "target": undefined,
        },
      }
    `);
    expect(convertedRunResult.success).toEqual(realRunResult.success);
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'Executor ran', {
      name: 'test',
    });
    expect(consoleSpy).toHaveBeenNthCalledWith(2, 'Executor ran', {
      name: 'test',
    });

    expect(convertedExecutor.toString()).toEqual(realBuilder.toString());
    expect(convertedExecutor.handler.toString()).toEqual(
      realBuilder.handler.toString()
    );
  });
});

function echo(options: { name: string }) {
  console.log('Executor ran', options);
  return {
    success: true,
  };
}

async function echoExecutor(options: { name: string }) {
  return echo(options);
}
