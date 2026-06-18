function loadConfig() {
  const config = require('./react-base').default;
  return {
    ruleNames: config.flatMap((entry) => Object.keys(entry.rules ?? {})),
    pluginNames: config.flatMap((entry) => Object.keys(entry.plugins ?? {})),
  };
}

describe('flat/react-base config', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('eslint/package.json');
  });

  it('uses eslint-plugin-import on ESLint <10', () => {
    jest.resetModules();
    jest.doMock('eslint/package.json', () => ({ version: '9.30.0' }));

    const { ruleNames, pluginNames } = loadConfig();

    expect(pluginNames).toContain('import');
    expect(ruleNames).toContain('import/first');
    expect(ruleNames).toContain('import/no-webpack-loader-syntax');
    expect(ruleNames).not.toContain('import-x/first');
  });

  it('swaps to eslint-plugin-import-x on ESLint v10', () => {
    jest.resetModules();
    jest.doMock('eslint/package.json', () => ({ version: '10.0.0' }));
    jest.doMock('eslint-plugin-import-x', () => ({ rules: {} }), {
      virtual: true,
    });

    const { ruleNames, pluginNames } = loadConfig();

    expect(pluginNames).toContain('import-x');
    expect(ruleNames).toContain('import-x/first');
    expect(ruleNames).toContain('import-x/no-amd');
    expect(ruleNames).toContain('import-x/no-webpack-loader-syntax');
    expect(ruleNames).not.toContain('import/first');
  });
});
