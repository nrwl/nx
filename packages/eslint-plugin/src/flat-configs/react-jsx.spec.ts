import {
  mockCjsModule,
  resetCjsMocks,
} from '@nx/devkit/internal-testing-utils';

function loadRuleNames(eslintVersion: string): string[] {
  mockCjsModule(import.meta.url, 'eslint/package.json', {
    version: eslintVersion,
  });
  delete require.cache[require.resolve('./react-jsx')];
  const config = require('./react-jsx').default;
  return config.flatMap((entry) => Object.keys(entry.rules ?? {}));
}

describe('flat/react-jsx config', () => {
  afterEach(() => {
    resetCjsMocks();
  });

  it('applies react, jsx-a11y and react-hooks rules on ESLint <10', () => {
    const ruleNames = loadRuleNames('9.30.0');

    expect(ruleNames).toContain('react-hooks/rules-of-hooks');
    expect(ruleNames).toContain('react/jsx-no-undef');
    expect(ruleNames).toContain('jsx-a11y/alt-text');
  });

  it('drops react and jsx-a11y and pins the classic react-hooks rules on ESLint v10', () => {
    const ruleNames = loadRuleNames('10.0.0');

    expect(ruleNames).toContain('react-hooks/rules-of-hooks');
    expect(ruleNames).toContain('react-hooks/exhaustive-deps');
    expect(ruleNames).not.toContain('react/jsx-no-undef');
    expect(ruleNames).not.toContain('jsx-a11y/alt-text');
    // classic subset only: no React Compiler rules from react-hooks v7
    expect(ruleNames).not.toContain('react-hooks/static-components');
  });
});
