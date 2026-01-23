import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import stylistic from '@stylistic/eslint-plugin';

const sharedTypeScriptRules = {
    'unicorn/no-array-for-each': 'error',
    '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@stylistic/brace-style': ['error', 'allman'],
    '@stylistic/indent': 'off',
    '@stylistic/object-curly-spacing': ['error', 'always'],
    '@stylistic/quotes': ['error', 'single'],
    '@stylistic/space-before-function-paren': ['error', 'never'],
    '@stylistic/comma-dangle': 'off',
    '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
    '@stylistic/lines-between-class-members': 'off',
    '@typescript-eslint/max-params': 'off',
    '@typescript-eslint/class-methods-use-this': 'off',
    '@typescript-eslint/no-magic-numbers': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/member-ordering': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/prefer-enum-initializers': 'off',
    '@typescript-eslint/prefer-readonly-parameter-types': 'off',
    '@typescript-eslint/prefer-literal-enum-member': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'off',
    '@typescript-eslint/no-extraneous-class': 'off',
    '@typescript-eslint/parameter-properties': ['error', {
        allow: ['readonly', 'public readonly', 'private readonly', 'protected readonly']
    }],
    '@typescript-eslint/no-dynamic-delete': 'off',
    'no-empty': 'off',
    '@typescript-eslint/naming-convention': ['error', { selector: 'enumMember', format: null }],
};

export default tseslint.config(
    {
        ignores: ['**/dist/**', '**/node_modules/**'],
    },
    {
        files: ['packages/**/*.ts'],
        ignores: ['**/*.spec.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.all,
        ],
        plugins: {
            unicorn,
            '@stylistic': stylistic,
        },
        languageOptions: {
            parserOptions: {
                project: ['./packages/*/tsconfig.lib.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: sharedTypeScriptRules,
    },
    {
        files: ['apps/fluff-demo-app/**/*.ts'],
        ignores: ['**/*.spec.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.all,
        ],
        plugins: {
            unicorn,
            '@stylistic': stylistic,
        },
        languageOptions: {
            parserOptions: {
                project: ['./apps/fluff-demo-app/tsconfig.lib.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: sharedTypeScriptRules,
    },
    {
        files: ['packages/**/*.spec.ts'],
        extends: [
            eslint.configs.recommended,
            ...tseslint.configs.all,
        ],
        plugins: {
            unicorn,
            '@stylistic': stylistic,
        },
        languageOptions: {
            parserOptions: {
                project: ['./packages/*/tsconfig.spec.json'],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            ...sharedTypeScriptRules,
            '@typescript-eslint/no-unused-expressions': 'off',
        },
    },
);
