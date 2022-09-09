import { interpolateEnvironmentVariablesToIndex } from './interpolate-env-variables-to-index';

describe('interpolateEnvironmentVariablesToIndex()', () => {
  const envDefaults = {
    NX_VARIABLE: 'foo',
    SOME_OTHER_VARIABLE: 'bar',
    DEPLOY_URL: 'baz',
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...envDefaults };
  });

  test('default env variables', () => {
    const content = `
<div>Nx Variable: %NX_VARIABLE%</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Deploy Url: %DEPLOY_URL%</div>
`;
    const expected = `
<div>Nx Variable: foo</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Deploy Url: baz</div>
`;
    expect(interpolateEnvironmentVariablesToIndex(content)).toBe(expected);
  });

  test('Deploy url set as option overrides DEPLOY_URL env variable', () => {
    const content = `
<div>Nx Variable: %NX_VARIABLE%</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Deploy Url: %DEPLOY_URL%</div>
`;
    const expected = `
<div>Nx Variable: foo</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Deploy Url: some-other-url.com</div>
`;
    expect(
      interpolateEnvironmentVariablesToIndex(content, 'some-other-url.com')
    ).toBe(expected);
  });

  test('No deploy url provided via either option', () => {
    delete process.env.DEPLOY_URL;
    const content = `
<div>Nx Variable: %NX_VARIABLE%</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Deploy Url: %DEPLOY_URL%</div>
`;
    const expected = `
<div>Nx Variable: foo</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Deploy Url: </div>
`;
    expect(interpolateEnvironmentVariablesToIndex(content)).toBe(expected);
  });

  test('NX_ prefixed option present in index.html, but not present in process.env', () => {
    delete process.env.DEPLOY_URL;
    const content = `
<div>Nx Variable: %NX_VARIABLE%</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Some other nx_variable: %NX_SOME_OTHER_VARIABLE%</div>
<div>Deploy Url: %DEPLOY_URL%</div>
`;
    const expected = `
<div>Nx Variable: foo</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Some other nx_variable: %NX_SOME_OTHER_VARIABLE%</div>
<div>Deploy Url: </div>
`;
    expect(interpolateEnvironmentVariablesToIndex(content)).toBe(expected);
  });
});
