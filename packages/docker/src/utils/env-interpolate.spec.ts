import { interpolateEnvVar } from './env-interpolate';

describe('interpolateEnvVar', () => {
  const originalEnv = process.env.NX_DOCKER_TEST_SECRET;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NX_DOCKER_TEST_SECRET;
    } else {
      process.env.NX_DOCKER_TEST_SECRET = originalEnv;
    }
  });

  it('expands ${VAR}', () => {
    process.env.NX_DOCKER_TEST_SECRET = '/path/to/secret';
    expect(interpolateEnvVar('${NX_DOCKER_TEST_SECRET}')).toEqual(
      '/path/to/secret'
    );
  });

  it('expands $VAR', () => {
    process.env.NX_DOCKER_TEST_SECRET = '/path/to/secret';
    expect(interpolateEnvVar('$NX_DOCKER_TEST_SECRET')).toEqual(
      '/path/to/secret'
    );
  });

  it('leaves the reference unchanged when the variable is unset', () => {
    delete process.env.NX_DOCKER_TEST_SECRET;
    expect(interpolateEnvVar('$NX_DOCKER_TEST_SECRET')).toEqual(
      '$NX_DOCKER_TEST_SECRET'
    );
  });

  it('leaves plain text without $ untouched', () => {
    expect(interpolateEnvVar('plain-value')).toEqual('plain-value');
  });
});
