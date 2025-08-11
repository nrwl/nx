---
title: Switching to ESLint's Flat Config Format
description: Learn how to migrate your Nx workspace to ESLint's new flat configuration format, understanding the benefits and implementation details.
---

# Switching to ESLint's flat config format

Version 8 of ESLint introduced a new configuration format called [Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new). The next major version will use this config format by default. The purpose of this format is to:

- push towards a single configuration format (in contrast to the existing `JSON`, `Yaml` and `JS`-based configs)
- enforce explicit native loading (instead of the implicit imports in `JSON` and `Yaml`)
- use a flat cascading of rules (instead of a mix of rules and overrides)

See below a direct comparison between `JSON`, `JS` and `Flat` config:
{% tabs %}
{% tab label="Flat" %}

```js {% fileName="eslint.config.cjs" %}
// the older versions were magically interpreting all the imports
// in flat config we do it explicitly
const nxPlugin = require('@nx/eslint-plugin');
const js = require('@eslint/js');
const baseConfig = require('./eslint.base.config.cjs');
const globals = require('globals');
const jsoncParser = require('jsonc-eslint-parser');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  js.configs.recommended,
  // this will spread the export blocks from the base config
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
  // there are no overrides, all the config blocks are "flat"
  {
    files: ['*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
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
];
```

{% /tab %}
{% tab label="JSON" %}

```json {% fileName=".eslintrc.json" %}
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

{% /tab %}
{% tab label="JS" %}

```js {% fileName=".eslintrc.js" %}
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

{% /tab %}
{% /tabs %}

For additional details, head over to [ESLint's official blog post](https://eslint.org/blog/2022/08/new-config-system-part-2/).

Since version 16.8.0, Nx supports the usage of flat config in the [@nx/eslint:lint](/technologies/eslint/api/executors/lint) executor and `@nx/*` generators, and provides an automated config conversion from `.eslintrc.json` config files.

## Converting workspace from .eslintrc.json to flat config

To convert workspace ESLint configurations from the default `.eslintrc.json` to the new flat config you need to run:

```shell
 nx g @nx/eslint:convert-to-flat-config
```

The generator will go through all the projects and convert their configurations to the new format. It will also convert the base `.eslintrc.json` and `.eslintignore`.

## Correctness and best practices

The purpose of this generator is to create a flat config that works the same way as the original `JSON` config did. Depending on the complexity of your original config, it may be using the `FlatCompat` utility to provide a compatibility wrapper around parts of the original config. You can improve those by following the [official migration guide](https://eslint.org/docs/latest/use/configure/migration-guide).
