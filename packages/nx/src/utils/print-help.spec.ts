import { Schema } from './params';
import { logger } from './logger';
import { printHelp } from './print-help';

describe('printHelp', () => {
  it('should sort options by priority and name', () => {
    const schema: Schema = {
      properties: {
        aImp: {
          'x-priority': 'important',
        },
        bImp: {
          'x-priority': 'important',
        },
        aNormal: {},
        bNormal: {},
        aDep: {
          'x-deprecated': 'great reason',
        },
        bDep: {
          'x-deprecated': 'even better reason',
        },
        aReq: {},
        bReq: {},
        aInt: {
          'x-priority': 'internal',
        },
        bInt: {
          'x-priority': 'internal',
        },
      },
      required: ['aReq', 'bReq'],
      description: 'description',
    };

    let output = '';
    jest.spyOn(logger, 'info').mockImplementation((x) => (output = x));

    printHelp('nx g @nx/demo:example', schema, {
      mode: 'generate',
      plugin: '@nx/demo',
      entity: 'example',
      aliases: ['ex'],
    });

    const flagsFromOutput = output
      .match(/--[a|b]\S*/g)
      .map((x) => x.replace('--', ''));

    expect(flagsFromOutput).toMatchInlineSnapshot(`
      [
        "aReq",
        "bReq",
        "aImp",
        "bImp",
        "aNormal",
        "bNormal",
        "aInt",
        "bInt",
        "aDep",
        "bDep",
      ]
    `);
  });
});
