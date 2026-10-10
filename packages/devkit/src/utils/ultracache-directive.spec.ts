import { hasUltracacheImportsDirective } from './ultracache-directive';

describe('hasUltracacheImportsDirective', () => {
  it.each([
    ['one directive', '// @nx-ultracache: imports\nimport "app";\n'],
    [
      'repeated directives',
      '// @nx-ultracache: imports\n// @nx-ultracache:imports\n',
    ],
  ])('accepts %s', (_, content) => {
    expect(hasUltracacheImportsDirective(content)).toBe(true);
  });

  it.each([
    ['only another directive', '// @nx-depends-on: app\n'],
    ['an empty value', '// @nx-ultracache:\n'],
    ['an unsupported value', '// @nx-ultracache: import\n'],
    [
      'an unsupported value next to a supported one',
      '// @nx-ultracache: imports\n// @nx-ultracache: all\n',
    ],
  ])('rejects %s', (_, content) => {
    expect(hasUltracacheImportsDirective(content)).toBe(false);
  });
});
