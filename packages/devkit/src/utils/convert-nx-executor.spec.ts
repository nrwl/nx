import { requireNx } from '../../nx';
import { convertNxExecutor } from './convert-nx-executor';

const { workspaceRoot } = requireNx();

describe('Convert Nx Executor', () => {
  it('should convertNxExecutor to builder correctly and produce the same output', async () => {
    // ARRANGE
    const { schema } = require('@angular-devkit/core');
    const {
      TestingArchitectHost,
      // nx-ignore-next-line
    } = require('@angular-devkit/architect/testing') as typeof import('@angular-devkit/architect/testing');
    const { Architect } = require('@angular-devkit/architect');

    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    const testArchitectHost = new TestingArchitectHost();
    testArchitectHost.workspaceRoot = workspaceRoot;
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
