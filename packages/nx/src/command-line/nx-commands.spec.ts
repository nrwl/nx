import { commandsObject } from 'nx/src/command-line/nx-commands';

describe('nx-commands', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

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

  it('should support args from the environment', () => {
    process.env.NX_DRY_RUN = 'true';
    process.env.NX_SKIP_NX_CACHE = 'false';
    const actual = commandsObject.parse('nx run project-e2e');
    expect(actual).toEqual(
      expect.objectContaining({
        dryRun: 'true',
        skipNxCache: 'false',
      })
    );
  });

  it('CLI args should take precedence over args from the environment', () => {
    process.env.NX_DRY_RUN = 'true';
    const actual = commandsObject.parse('nx run project-e2e --dryRun=false');
    expect(actual).toEqual(
      expect.objectContaining({
        dryRun: 'false',
      })
    );
  });
});
