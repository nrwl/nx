import { withEnvironmentVariables } from './with-environment';

describe('withEnvironmentVariables', () => {
  const key = 'NX_WITH_ENVIRONMENT_SPEC';

  afterEach(() => {
    delete process.env[key];
  });

  it('should leave a variable that was never set absent, not the string "undefined"', () => {
    // Node coerces `process.env.X = undefined` to the string "undefined", which
    // is truthy. A helper that restores that way turns "unset it for this test"
    // into "set it for every test after this one".
    expect(key in process.env).toBe(false);

    withEnvironmentVariables({ [key]: undefined }, () => {});

    expect(key in process.env).toBe(false);
    expect(process.env[key]).toBeUndefined();
  });

  it('should not make a cleared variable read as truthy afterwards', () => {
    // The shape that actually bit: `!!process.env.X` is what is-sandbox.ts and
    // friends do, and "undefined" passes it.
    withEnvironmentVariables({ [key]: undefined }, () => {});

    expect(!!process.env[key]).toBe(false);
  });

  it('should restore a previous value rather than deleting it', () => {
    process.env[key] = 'original';

    withEnvironmentVariables({ [key]: 'temporary' }, () => {
      expect(process.env[key]).toBe('temporary');
    });

    expect(process.env[key]).toBe('original');
  });

  it('should restore after an async callback rejects', () => {
    process.env[key] = 'original';

    return withEnvironmentVariables({ [key]: 'temporary' }, async () => {
      throw new Error('boom');
    }).catch(() => {
      expect(process.env[key]).toBe('original');
    });
  });
});
