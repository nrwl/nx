---
title: 'Configuring ESLint with TypeScript'
description: 'Learn how to properly configure ESLint with TypeScript in your Nx workspace, including understanding Nx\'s ESLint configurations, setting up type-checking, and managing parser options for optimal performance.'
---

# Configuring ESLint with TypeScript

ESLint is powerful linter by itself, able to work on the syntax of your source files and assert things about based on the rules you configure. It gets even more powerful, however, when TypeScript type-checker is layered on top of it when analyzing TypeScript files, which is something that `@typescript-eslint` allows us to do.

## Nx ESLint Configurations

Nx provides several pre-configured ESLint configurations out of the box. These configs are designed to provide sensible defaults while maintaining flexibility for customization.

### Available Configurations

{% tabs %}
{% tab label="Flat Config (Default)" %}

```javascript {% fileName="eslint.config.mjs" %}
import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Your custom rules here
    },
  },
];
```

{% /tab %}
{% tab label="Legacy .eslintrc" %}

```json
{
  "extends": ["plugin:@nx/typescript"],
  "rules": {
    // Your custom rules here
  }
}
```

{% /tab %}
{% /tabs %}

### Purpose of Nx Configurations

- **`@nx/eslint-plugin` base config**: Provides the foundation for all Nx workspaces, including the Nx ESLint plugin and ignoring the `.nx` cache directory
- **TypeScript config**: Applies TypeScript-specific rules and parser configuration for `.ts` and `.tsx` files, including recommended rules from `@typescript-eslint`
- **JavaScript config**: Configures ESLint for `.js` and `.jsx` files with appropriate parser settings and globals for both browser and Node.js environments
- **React configs**: Adds React-specific rules and JSX support (available as `flat/react`, `flat/react-base`, etc.)
- **Angular configs**: Provides Angular-specific linting rules for components and templates

### Customizing Rules

You can override any rules provided by the Nx configurations by adding them after the spread configurations:

{% tabs %}
{% tab label="Flat Config" %}

```javascript {% fileName="eslint.config.mjs" %}
import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Override or add custom rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Add your own custom rules
      'no-console': 'warn',
    },
  },
];
```

{% /tab %}
{% tab label="Legacy .eslintrc" %}

```json
{
  "extends": ["plugin:@nx/typescript"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "no-console": "warn"
  }
}
```

{% /tab %}
{% /tabs %}

## Performance Considerations

Nx optimizes ESLint performance by default. Only set `parserOptions.project` when using rules that require type information, as TypeScript's type-checker is expensive to run. Never configure `parserOptions.project` in your workspace's root configuration.

Let's take an example of an ESLint config that Nx might generate for you out of the box for a Next.js project called `tuskdesk`:

{% tabs %}
{% tab label="Flat Config" %}

```javascript {% fileName="apps/tuskdesk/eslint.config.mjs" %}
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
];
```

{% /tab %}
{% tab label="Legacy .eslintrc" %}

```jsonc {% fileName="apps/tuskdesk/.eslintrc.json" %}
{
  "extends": ["plugin:@nx/react", "../../.eslintrc.json"],
  "ignorePatterns": ["!**/*"],
  "overrides": [
    {
      "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
      "rules": {}
    },
    {
      "files": ["*.ts", "*.tsx"],
      "rules": {}
    },
    {
      "files": ["*.js", "*.jsx"],
      "rules": {}
    }
  ]
}
```

{% /tab %}
{% /tabs %}

Here we do _not_ have `parserOptions.project`, which is appropriate because we are not leveraging any rules which require type information.

If we now come in and add a rule which does require type information, for example `@typescript-eslint/await-thenable`, our config will look as follows:

{% tabs %}
{% tab label="Flat Config" %}

```javascript {% fileName="apps/tuskdesk/eslint.config.mjs" %}
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // This rule requires the TypeScript type checker to be present when it runs
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
];
```

{% /tab %}
{% tab label="Legacy .eslintrc" %}

```jsonc {% fileName="apps/tuskdesk/.eslintrc.json" %}
{
  "extends": ["plugin:@nx/react", "../../.eslintrc.json"],
  "ignorePatterns": ["!**/*"],
  "overrides": [
    {
      "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
      "rules": {
        // This rule requires the TypeScript type checker to be present when it runs
        "@typescript-eslint/await-thenable": "error"
      }
    },
    {
      "files": ["*.ts", "*.tsx"],
      "rules": {}
    },
    {
      "files": ["*.js", "*.jsx"],
      "rules": {}
    }
  ]
}
```

{% /tab %}
{% /tabs %}

Now if we try and run `nx lint tuskdesk` we will get an error

```{% command="nx lint tuskdesk" %}
> nx run tuskdesk:lint

Linting "tuskdesk"...

    Error: You have attempted to use a lint rule which requires the full
    TypeScript type-checker to be available, but you do not have
    `parserOptions.project` configured to point at your project
    tsconfig.json files in the relevant TypeScript file "overrides"
    block of your project ESLint config

```

The solution is to update our config once more, this time to set `parserOptions.project` to appropriately point at our various tsconfig.json files which belong to our project:

{% tabs %}
{% tab label="Flat Config" %}

```javascript {% fileName="apps/tuskdesk/eslint.config.mjs" %}
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // We set parserOptions.project for the project to allow TypeScript to create the type-checker behind the scenes when we run linting
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.*?.json'],
        tsconfigRootDir: import.meta.dirname
      },
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
];
```

{% /tab %}
{% tab label="Legacy .eslintrc" %}

```jsonc {% fileName="apps/tuskdesk/.eslintrc.json" %}
{
  "extends": ["plugin:@nx/react", "../../.eslintrc.json"],
  "ignorePatterns": ["!**/*"],
  "overrides": [
    {
      "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
      // We set parserOptions.project for the project to allow TypeScript to create the type-checker behind the scenes when we run linting
      "parserOptions": {
        "project": ["apps/tuskdesk/tsconfig.*?.json"]
      },
      "rules": {
        "@typescript-eslint/await-thenable": "error"
      }
    },
    {
      "files": ["*.ts", "*.tsx"],
      "rules": {}
    },
    {
      "files": ["*.js", "*.jsx"],
      "rules": {}
    }
  ]
}
```

{% /tab %}
{% /tabs %}

And that's it! Now any rules requiring type information will run correctly when we run `nx lint tuskdesk`.

{% callout type="warning" title="Using Next.js" %}
As well as adapting the path to match your project's real path, please be aware that if you apply the above to a **Next.js** application, you should change the glob pattern at the end to be `tsconfig(.*)?.json`.

E.g. if `tuskdesk` had been a Next.js app, we would have written: `"project": ["apps/tuskdesk/tsconfig(.*)?.json"]`
{% /callout %}
