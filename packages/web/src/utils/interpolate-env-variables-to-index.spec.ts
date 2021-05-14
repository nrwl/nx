import { interpolateEnvironmentVariablesToIndex } from './interpolate-env-variables-to-index';

describe('interpolateEnvironmentVariablesToIndex()', () => {
  const envDefaults = {
    NX_VARIABLE: 'foo',
    SOME_OTHER_VARIABLE: 'bar',
    PUBLIC_URL: 'baz',
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...envDefaults };
  });

  test('default env variables', () => {
    const content = `
<div>Nx Variable: %NX_VARIABLE%</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Public Url: %PUBLIC_URL%</div>
`;
    const expected = `
<div>Nx Variable: foo</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Public Url: baz</div>
`;
    expect(interpolateEnvironmentVariablesToIndex(content)).toBe(expected);
  });

  test('Public url set as option overrides PUBLIC_URL env variable', () => {
    const content = `
<div>Nx Variable: %NX_VARIABLE%</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Public Url: %PUBLIC_URL%</div>
`;
    const expected = `
<div>Nx Variable: foo</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Public Url: some-other-url.com</div>
`;
    expect(
      interpolateEnvironmentVariablesToIndex(content, 'some-other-url.com')
    ).toBe(expected);
  });

  test('No public url provided via either option', () => {
    delete process.env.PUBLIC_URL;
    const content = `
<div>Nx Variable: %NX_VARIABLE%</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Public Url: %PUBLIC_URL%</div>
`;
    const expected = `
<div>Nx Variable: foo</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Public Url: </div>
`;
    expect(interpolateEnvironmentVariablesToIndex(content)).toBe(expected);
  });

  test('NX_ prefixed option present in index.html, but not present in process.env', () => {
    delete process.env.PUBLIC_URL;
    const content = `
<div>Nx Variable: %NX_VARIABLE%</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Some other nx_variable: %NX_SOME_OTHER_VARIABLE%</div>
<div>Public Url: %PUBLIC_URL%</div>
`;
    const expected = `
<div>Nx Variable: foo</div>
<div>Some other variable: %SOME_OTHER_VARIABLE%</div>
<div>Some other nx_variable: %NX_SOME_OTHER_VARIABLE%</div>
<div>Public Url: </div>
`;
    expect(interpolateEnvironmentVariablesToIndex(content)).toBe(expected);
  });
});
