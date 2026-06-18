function loadRuleNames(): string[] {
  const config = require('./react-jsx').default;
  return config.flatMap((entry) => Object.keys(entry.rules ?? {}));
}

describe('flat/react-jsx config', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('eslint/package.json');
  });

  it('applies react, jsx-a11y and react-hooks rules on ESLint <10', () => {
    jest.resetModules();
    jest.doMock('eslint/package.json', () => ({ version: '9.30.0' }));

    const ruleNames = loadRuleNames();

    expect(ruleNames).toContain('react-hooks/rules-of-hooks');
    expect(ruleNames).toContain('react/jsx-no-undef');
    expect(ruleNames).toContain('jsx-a11y/alt-text');
  });

  it('drops react and jsx-a11y and pins the classic react-hooks rules on ESLint v10', () => {
    jest.resetModules();
    jest.doMock('eslint/package.json', () => ({ version: '10.0.0' }));

    const ruleNames = loadRuleNames();

    expect(ruleNames).toContain('react-hooks/rules-of-hooks');
    expect(ruleNames).toContain('react-hooks/exhaustive-deps');
    expect(ruleNames).not.toContain('react/jsx-no-undef');
    expect(ruleNames).not.toContain('jsx-a11y/alt-text');
    // classic subset only: no React Compiler rules from react-hooks v7
    expect(ruleNames).not.toContain('react-hooks/static-components');
  });
});
