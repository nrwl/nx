# Using ESLint in Nx Workspaces

## Rules requiring type information

ESLint is powerful linter by itself, able to work on the syntax of your source files and assert things about based on the rules you configure. It gets even more powerful, however, when TypeScript type-checker is layered on top of it when analyzing TypeScript files, which is something that `@typescript-eslint` allows us to do.

By default, Nx sets up your ESLint configs with performance in mind - we want your linting to run as fast as possible. Because creating the necessary so called TypeScript `Program`s required to create the type-checker behind the scenes is relatively expensive compared to pure syntax analysis, you should only configure the `parserOptions.project` option in your project's `.eslintrc.json` when you need to use rules requiring type information (and you should not configure `parserOptions.project` in your workspace's root `.eslintrc.json`).

Let's take an example of an ESLint config that Nx might generate for you out of the box for a Next.js project called `tuskdesk`:

**apps/tuskdesk/.eslintrc.json**

```jsonc
{
  "extends": ["plugin:@nrwl/nx/react", "../../.eslintrc.json"],
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

Here we do _not_ have `parserOptions.project`, which is appropriate because we are not leveraging any rules which require type information.

If we now come in and add a rule which does require type information, for example `@typescript-eslint/await-thenable`, our config will look as follows:

**apps/tuskdesk/.eslintrc.json**

```jsonc
{
  "extends": ["plugin:@nrwl/nx/react", "../../.eslintrc.json"],
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

Now if we try and run `nx lint tuskdesk` we will get an error

```bash
> nx run tuskdesk:lint

Linting "tuskdesk"...

    Error: You have attempted to use a lint rule which requires the full
    TypeScript type-checker to be available, but you do not have
    `parserOptions.project` configured to point at your project
    tsconfig.json files in the relevant TypeScript file "overrides"
    block of your project ESLint config `apps/tuskdesk/.eslintrc.json`

```

The solution is to update our config once more, this time to set `parserOptions.project` to appropriately point at our various tsconfig.json files which belong to our project:

**apps/tuskdesk/.eslintrc.json**

```jsonc
{
  "extends": ["plugin:@nrwl/nx/react", "../../.eslintrc.json"],
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

And that's it! Now any rules requiring type information will run correctly when we run `nx lint tuskdesk`.

{% callout type="warning" title="Using Next.js" %}
As well as adapting the path to match your project's real path, please be aware that if you apply the above to a **Next.js** application, you should change the glob pattern at the end to be `tsconfig(.*)?.json`.

E.g. if `tuskdesk` had been a Next.js app, we would have written: `"project": ["apps/tuskdesk/tsconfig(.*)?.json"]`
{% /callout %}
