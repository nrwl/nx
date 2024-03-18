import { commandsObject } from './nx-commands';

import * as yargsParser from 'yargs-parser';

describe('nx-commands', () => {
  it('should parse dot notion cli args', () => {
    const actual = yargsParser(
      [
        'nx',
        'e2e',
        'project-e2e',
        '--env.NX_API_URL=http://localhost:4200',
        '--abc.123.xyx=false',
        '--a.b=3',
      ],
      commandsObject.parserConfiguration
    );

    expect(actual).toEqual(
      expect.objectContaining({
        abc: {
          '123': {
            xyx: 'false',
          },
        },
        a: {
          b: 3,
        },
        env: {
          NX_API_URL: 'http://localhost:4200',
        },
      })
    );
  });
});
