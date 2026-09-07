---
title: Migrate from .eslintrc to ESLint Flat Config
description: 'Migrate .eslintrc to ESLint flat config step by step: eslint.config.mjs setup, FlatCompat for legacy configs, Next.js gotchas, and Nx automation.'
sidebar:
  label: Migrate to flat config
filter: 'type:Guides'
topics:
  - 'ESLint'
---

{% llm_copy_prompt title="Let an AI agent migrate it for you" %}

Migrate this Nx workspace from .eslintrc to ESLint flat config, following the instructions on the page below.

1. Run `nx g @nx/eslint:convert-to-flat-config`. Convert any JS-based eslintrc files (`.eslintrc.js`, `.eslintrc.cjs`) yourself using the page's migration steps.
2. Handle rules removed in typescript-eslint v8 and the ESLint v9 runtime changes as the page describes: drop removed formatting rules, apply the renames and the ban-types split, update plugins that crash, and fix removed formatters and CLI flags.
3. Find the lint target: check `nx.json` plugins for `@nx/eslint/plugin` and its `targetName` (default `lint`), and check `project.json` / `package.json` files for explicit lint targets.
4. Run `nx reset`, then `nx run-many -t <lint-target>` and fix failures until every project passes. Disable newly preset-enabled rules you never configured instead of editing source to satisfy them, and never weaken a rule the workspace configured explicitly.

Page: {pageUrl}
{% /llm_copy_prompt %}

ESLint flat config replaces `.eslintrc` with an `eslint.config.mjs` file that exports an
array of config objects.
Flat config has been the default since ESLint 9, and ESLint 10 no longer reads
`.eslintrc` files at all, so any project still on the legacy format has to migrate before
upgrading.

## What is ESLint flat config?

Flat config is a JavaScript-first configuration system that lives in `eslint.config.mjs` (or
`.js`/`.cjs`) files - in a monorepo, typically one per project plus a shared base config.
It makes three changes to the legacy format:

- One file format replaces the JSON, YAML, and JS `.eslintrc` variants.
- Explicit `import` statements replace implicit string-based loading of plugins and parsers.
- Config objects scoped by `files` patterns replace nested `overrides`.

## Convert files automatically

In an Nx workspace, the
[@nx/eslint:convert-to-flat-config generator](/docs/technologies/eslint/generators#convert-to-flat-config)
converts every project's ESLint configuration in one pass:

```shell
nx g @nx/eslint:convert-to-flat-config
```

The generator walks all projects, converts each `.eslintrc.json` to flat config, converts the
base config at the workspace root, and folds `.eslintignore` files into `ignores` entries.
It does not convert JavaScript-based eslintrc files (`.eslintrc.js`, `.eslintrc.cjs`), so
convert those by hand using the steps below.
New Nx workspaces generate flat config by default, and the
[@nx/eslint:lint executor](/docs/technologies/eslint/executors#lint) runs it without extra
configuration.

The generator aims to produce a flat config that behaves exactly like your original JSON
config, so depending on the complexity of the original it may wrap parts in `FlatCompat`.
Review the converted configs before deleting anything: check that each override kept its
`parser` - a dropped parser surfaces as `Parsing error: Unexpected token` on TypeScript files.
You can convert those sections to native flat config afterwards, by hand or with AI assistance
(recommended): convert when the plugin documents a flat preset (typescript-eslint,
`eslint-plugin-react`), and keep the shim for shared configs that don't ship one.

## Convert files manually

As an alternative to the generator, or for the JS-based eslintrc files it skips, convert each
config yourself.
The [ESLint migration guide](https://eslint.org/docs/latest/use/configure/migration-guide) maps
every legacy option to its flat config equivalent.

1. Create `eslint.config.mjs` at the root of your repository.
   String references like `"eslint:recommended"` become imports:

   ```js
   // eslint.config.mjs
   import js from '@eslint/js';

   export default [js.configs.recommended];
   ```

1. Convert `env` and `parser` settings to `languageOptions`.
   Environments like `env: { node: true }` become imported globals:

   ```js
   // eslint.config.mjs
   import globals from 'globals';
   import tsParser from '@typescript-eslint/parser';

   export default [
     {
       languageOptions: {
         parser: tsParser,
         globals: { ...globals.node },
       },
     },
   ];
   ```

1. Replace `overrides` with config objects scoped by `files`.
   Each entry in the legacy `overrides` array becomes a top-level object.
   Flat config matches patterns against the full path relative to the config file, while legacy
   `overrides` matched slash-less patterns against the file basename, so `*.ts` becomes `**/*.ts`:

   ```js
   // eslint.config.mjs
   export default [
     {
       files: ['**/*.spec.ts'],
       rules: { 'max-lines': 'off' },
     },
   ];
   ```

1. Bridge legacy shareable configs with `FlatCompat` from `@eslint/eslintrc`.
   Only do this for configs that don't publish a flat config export yet:

   ```js
   // eslint.config.mjs
   import { FlatCompat } from '@eslint/eslintrc';

   const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

   export default [...compat.extends('some-legacy-shareable-config')];
   ```

   `import.meta.dirname` requires Node.js 20.11 or later.
   On older versions, derive the directory with `path.dirname(fileURLToPath(import.meta.url))`.

Delete the `.eslintrc.*` files once `npx eslint .` runs clean in each project with the new config.
Move `.eslintignore` patterns into an `ignores` entry - flat config doesn't read
`.eslintignore`, and ESLint 10 removed support for it entirely.

## Handle rules removed in typescript-eslint v8

typescript-eslint v8 removed several rules, and a flat config that references a removed rule
fails to load.
Before editing, confirm your workspace is on typescript-eslint v8 or later (check
`typescript-eslint` or `@typescript-eslint/eslint-plugin` in `package.json`) - on v7 the rules
still exist.

- **Formatting rules are gone** - `@typescript-eslint/indent`, `quotes`, `semi`, `brace-style`,
  `comma-dangle`, `comma-spacing`, `key-spacing`, `keyword-spacing`, `member-delimiter-style`,
  `no-extra-parens`, `no-extra-semi`, `object-curly-spacing`,
  `padding-line-between-statements`, `space-before-blocks`, `space-before-function-paren`,
  `space-infix-ops`, `type-annotation-spacing`, and the other spacing rules were dropped.
  Remove them from your configs, or adopt [ESLint Stylistic](https://eslint.style) if you want
  lint-enforced formatting.
- **Two rules were renamed** - replace `@typescript-eslint/no-throw-literal` with
  `@typescript-eslint/only-throw-error`, and `@typescript-eslint/no-useless-template-literals`
  with `@typescript-eslint/no-unnecessary-template-expression`, keeping your options.
  `only-throw-error` requires typed linting: the config block for TypeScript files must set
  `parserOptions.projectService: true` (or `parserOptions.project`), or ESLint fails to load
  the rule.
- **`@typescript-eslint/ban-types` split into three rules** -
  `@typescript-eslint/no-empty-object-type` (the `{}` type),
  `@typescript-eslint/no-unsafe-function-type` (the `Function` type), and
  `@typescript-eslint/no-wrapper-object-types` (`String`, `Number`, `Boolean`, and the other
  wrappers).
  If the old entry was just an error level, set all three to that level.
  If it customized `types`, translate each banned type to whichever successor rule covers it.

## What else changes in ESLint v9?

Flat config is only part of the v9 upgrade. These runtime changes surface during the same migration:

- **Preset defaults shifted** - The ESLint v9 and typescript-eslint v8 recommended sets enable rules they didn't before, so a previously passing workspace can newly fail. Disable a newly reported rule you never configured, with a short comment, instead of editing source files to satisfy it.
- **A crash is not a finding** - Errors like `TypeError: context.getAncestors is not a function` or `Could not find "<rule>" in plugin` mean an installed plugin predates ESLint v9. Update the plugin and prefer its flat entry point (for example `eslint-plugin-cypress/flat`) instead of disabling its rules.
- **Some output formatters were removed** - `stylish`, `html`, `json`, and `json-with-metadata` remain built in. For a removed one like `junit`, install the community package (`eslint-formatter-junit`) and reference it by package name in the lint target's `format` option.
- **Removed CLI flags** - `--rulesdir`, `--ext`, and `--resolve-plugins-relative-to` are gone, along with the matching `@nx/eslint:lint` options. Move file targeting into `files` and `ignores` in the config.
- **Local rule API moved to `SourceCode`** - If the workspace authors its own rules, `context.getScope()` becomes `sourceCode.getScope(node)` (and similar for `getAncestors`, `getDeclaredVariables`, `getText`, and `parserServices`), and a rule that accepts options must declare `meta.schema`.

After the migration, run `nx reset` so renamed configs are re-detected, then confirm `nx run-many -t lint` passes across the workspace.

## Migrate a Next.js project to flat config

`eslint-config-next` 16 and later ships flat config natively, so you don't need
`FlatCompat`.
Import `eslint-config-next/core-web-vitals` in `eslint.config.mjs` and spread it into your
config array:

```js
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
```

For TypeScript projects, add `eslint-config-next/typescript` to the array.
Next.js 16 also removed the `next lint` command, so run `npx eslint .` directly.
For rule reference and monorepo `rootDir` settings, see the
[Next.js ESLint documentation](https://nextjs.org/docs/app/api-reference/config/eslint).

### Fix: TypeError: Converting circular structure to JSON with FlatCompat and next/core-web-vitals

Wrapping `next/core-web-vitals` with `FlatCompat` throws
`TypeError: Converting circular structure to JSON`.
The config includes `eslint-plugin-react-hooks`, whose configuration references itself, and
expanding it through `FlatCompat` produces a circular structure:

```js
// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

// Throws: TypeError: Converting circular structure to JSON
export default [...compat.extends('next/core-web-vitals')];
```

Drop `FlatCompat` and use the native flat config export instead, upgrading to
`eslint-config-next` 16 or later if your version doesn't provide it:

```js
// eslint.config.mjs
import nextVitals from 'eslint-config-next/core-web-vitals';

export default [...nextVitals];
```

If you can't upgrade, register `@next/eslint-plugin-next` as a plugin directly and spread its
recommended rules into a config object rather than extending through `FlatCompat`.

## Compare eslintrc and flat config formats

Compare the same Nx workspace configuration in flat, JSON, and JS formats:

{% tabs %}
{% tabitem label="Flat" %}

```js
// eslint.config.mjs
// flat config imports plugins and parsers explicitly instead of resolving string names
import nxPlugin from '@nx/eslint-plugin';
import js from '@eslint/js';
import baseConfig from './eslint.base.config.mjs';
import globals from 'globals';
import jsoncParser from 'jsonc-eslint-parser';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  // spreads the config objects from the base config
  ...baseConfig,
  { plugins: { '@nx': nxPlugin } },
  {
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': ['error'],
    },
  },
  // config objects scoped by files replace nested overrides
  {
    files: ['**/*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
];
```

{% /tabitem %}
{% tabitem label="JSON" %}

```json
// .eslintrc.json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "env": {
    "node": true
  },
  "extends": ["eslint:recommended", "./.eslintrc.base.json"],
  "plugins": ["@nx"],
  "rules": {
    "@typescript-eslint/explicit-module-boundary-types": "error"
  },
  "overrides": [
    {
      "files": ["*.json"],
      "parser": "jsonc-eslint-parser",
      "rules": {}
    },
    {
      "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
      "rules": {
        "@nx/enforce-module-boundaries": [
          "error",
          {
            "enforceBuildableLibDependency": true,
            "allow": [],
            "depConstraints": [
              {
                "sourceTag": "*",
                "onlyDependOnLibsWithTags": ["*"]
              }
            ]
          }
        ]
      }
    }
  ]
}
```

{% /tabitem %}
{% tabitem label="JS" %}

```js
// .eslintrc.js
module.exports = {
  root: true,
  env: {
    node: true,
  },
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', './.eslintrc.base.js'],
  plugins: ['@nx'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': ['error'],
  },
  overrides: [
    {
      files: ['*.json'],
      parser: 'jsonc-eslint-parser',
      rules: {},
    },
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      rules: {
        '@nx/enforce-module-boundaries': [
          'error',
          {
            enforceBuildableLibDependency: true,
            allow: [],
            depConstraints: [
              {
                sourceTag: '*',
                onlyDependOnLibsWithTags: ['*'],
              },
            ],
          },
        ],
      },
    },
  ],
};
```

{% /tabitem %}
{% /tabs %}
