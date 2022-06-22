import { commandsObject } from './nx-commands';

describe('nx-commands', () => {
  it('should parse dot notion cli args', () => {
    const actual = commandsObject.parse(
      'nx e2e project-e2e --env.NX_API_URL=http://localhost:4200 --abc.123.xyx=false --a.b=3'
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
