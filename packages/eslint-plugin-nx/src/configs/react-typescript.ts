/**
 * This configuration is intended to be applied to ONLY .ts and .tsx files within a
 * React project in an Nx workspace.
 *
 * It should therefore NOT contain any rules or plugins which are generic
 * to all variants of React projects, e.g. TypeScript vs JavaScript, .js vs .jsx etc
 *
 * This configuration is intended to be combined with other configs from this
 * package.
 */
export default {
  rules: {
    // TypeScript"s `noFallthroughCasesInSwitch` option is more robust (#6906)
    'default-case': 'off',
    // "tsc" already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/291)
    'no-dupe-class-members': 'off',
    // "tsc" already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/477)
    'no-undef': 'off',

    // Add TypeScript specific rules (and turn off ESLint equivalents)
    '@typescript-eslint/consistent-type-assertions': 'warn',
    'no-array-constructor': 'off',
    '@typescript-eslint/no-array-constructor': 'warn',
    '@typescript-eslint/no-namespace': 'error',
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
      'warn',
      {
        functions: false,
        classes: false,
        variables: false,
        typedefs: false,
      },
    ],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        args: 'none',
        ignoreRestSiblings: true,
      },
    ],
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'warn',
    '@typescript-eslint/no-unused-expressions': [
      'error',
      {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      },
    ],
  },
};
