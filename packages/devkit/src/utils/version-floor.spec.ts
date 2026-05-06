import { throwForUnsupportedVersion } from './version-floor';

describe('throwForUnsupportedVersion', () => {
  it('throws an error naming the package, installed version, and floor', () => {
    expect(() =>
      throwForUnsupportedVersion('@angular/core', '18.2.0', '19.0.0')
    ).toThrowErrorMatchingInlineSnapshot(`
      "Unsupported version of \`@angular/core\` detected.

        Installed: 18.2.0
        Supported: >= 19.0.0

      Update \`@angular/core\` to 19.0.0 or higher."
    `);
  });

  it('formats messages for unscoped packages too', () => {
    expect(() => throwForUnsupportedVersion('vite', '5.4.0', '6.0.0'))
      .toThrowErrorMatchingInlineSnapshot(`
      "Unsupported version of \`vite\` detected.

        Installed: 5.4.0
        Supported: >= 6.0.0

      Update \`vite\` to 6.0.0 or higher."
    `);
  });
});
