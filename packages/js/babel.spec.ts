import { transformSync } from '@babel/core';

describe('@nx/js/babel preset', () => {
  // Regression for https://github.com/nrwl/nx/issues/36205: the class-properties
  // plugin shares @babel/helper-create-class-features-plugin, which hard-errors on
  // private methods and static blocks unless their transforms are also loaded. This
  // surfaces when an ESM-only dep using that syntax is transformed via a
  // transformIgnorePatterns exception.
  it('does not error on private methods, static blocks, or "#private in obj" checks', () => {
    const code = [
      'class Container {',
      '  static registry = new Map<string, boolean>();',
      '  static {',
      "    Container.registry.set('init', true);",
      '  }',
      '  #buildAutobindOptions(autobind: boolean, defaultScope: string) {',
      '    return autobind ? { scope: defaultScope } : undefined;',
      '  }',
      '  has() {',
      '    return #buildAutobindOptions in this;',
      '  }',
      '}',
    ].join('\n');

    const result = transformSync(code, {
      babelrc: false,
      configFile: false,
      filename: 'container.ts',
      presets: [require.resolve('./babel')],
    });

    expect(result?.code).toBeTruthy();
    // Private members are transformed away rather than left to error.
    expect(result?.code).not.toContain('#buildAutobindOptions');
  });
});
