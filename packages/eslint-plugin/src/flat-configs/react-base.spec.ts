import {
  mockCjsModule,
  resetCjsMocks,
} from '@nx/devkit/internal-testing-utils';

function loadConfig(eslintVersion: string) {
  mockCjsModule(import.meta.url, 'eslint/package.json', {
    version: eslintVersion,
  });
  delete require.cache[require.resolve('./react-base')];
  const config = require('./react-base').default;
  return {
    ruleNames: config.flatMap((entry) => Object.keys(entry.rules ?? {})),
    plugins: Object.assign({}, ...config.map((entry) => entry.plugins ?? {})),
  };
}

describe('flat/react-base config', () => {
  afterEach(() => {
    resetCjsMocks();
  });

  it('uses eslint-plugin-import on ESLint <10', () => {
    const { ruleNames, plugins } = loadConfig('9.30.0');

    expect(Object.keys(plugins)).toContain('import');
    expect(ruleNames).toContain('import/first');
    expect(ruleNames).toContain('import/no-webpack-loader-syntax');
    expect(ruleNames).not.toContain('import-x/first');
  });

  it('swaps to eslint-plugin-import-x on ESLint v10', () => {
    const { ruleNames, plugins } = loadConfig('10.0.0');

    expect(ruleNames).toContain('import-x/first');
    expect(ruleNames).toContain('import-x/no-amd');
    expect(ruleNames).toContain('import-x/no-webpack-loader-syntax');
    expect(ruleNames).not.toContain('import/first');
    // ESLint rejects two different objects under one plugin name, so the preset
    // must register the object import-x's own flat configs use.
    expect(plugins['import-x']).toBe(
      require('eslint-plugin-import-x').flatConfigs.recommended.plugins[
        'import-x'
      ]
    );
  });
});
