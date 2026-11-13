#### Add the `@nx/directive-checks` lint rule

Nx 24.1 adds the `@nx/directive-checks` rule to `@nx/eslint-plugin`. It reports mistakes in the `@nx-` directives at the top of a file that Nx ignores or fails on, such as a misspelled directive name or an `@nx-depends-on` pattern that matches no project.

The migration adds the rule as `error` to the root ESLint config that project configs extend. That's the root base config (`eslint.base.config.mjs` or `.eslintrc.base.json`) when the workspace has one, and the root config otherwise. It adds the rule when all of these are true:

- The root has a supported ESLint config.
- That config registers the `@nx` plugin for every file in a shape Nx generates: `...nx.configs['flat/base']` directly in the exported array with `nx` imported from `@nx/eslint-plugin`, or `"plugins": ["@nx"]` at the top level of a `.json` config.
- No ESLint config mentions `@nx/directive-checks`.
- A file behind an atomized target (`<target>--<file path>`) has `@nx-depends-on` or `@nx-ignore-server-inputs` in its leading comment block.

Lint then fails on every problem the rule reports, such as a misspelled `@nx-` directive in any file that config lints. Fix the reported lines.

When an ESLint config uses `@nx/eslint-plugin` but the migration can't verify that the config it would change registers it for every file, it leaves that config unchanged and prints a warning. It does the same for a root config it can't edit, such as `eslint.config.ts`. Add the rule to a config that registers `@nx` for the files it checks.

The migration adds the rule without a `files` pattern. In a flat config it adds its own entry, and in `.eslintrc.json` it adds a top-level rule. The rule then runs on every file the config already lints, and ESLint doesn't start linting files that no parser is set up for.

#### Sample code changes

##### Before

```js title="eslint.config.mjs"
import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  // ... other config
];
```

##### After

```js title="eslint.config.mjs"
import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  // ... other config
  {
    rules: {
      '@nx/directive-checks': 'error',
    },
  },
];
```
