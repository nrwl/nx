#### Prepare the workspace for ESLint v10

ESLint v10 removed the eslintrc configuration format and the `ESLINT_USE_FLAT_CONFIG` escape hatch, so `.eslintrc.*` files are no longer read at all. It also raised the Node.js floor to `^20.19.0 || ^22.13.0 || >=24`, and a few widely used plugins have no v10 release.

This migration runs when the workspace lands on ESLint v10. It converts the eslintrc configs that are left, replaces the plugins that cannot run on v10, and reports whatever it could not do safely so the paired prompt can finish it.

##### When the ESLint v10 update is held back

Two framework integrations pin ESLint v9 through their own peer ranges, so the update to ESLint v10 is skipped for a workspace that has either of them. Those workspaces stay on v9, which is still supported, and move to v10 once the integration does.

- `angular-eslint` below 21.3, the release that added ESLint v10 to its peer range.
- `eslint-config-next` v15 and lower. Support for ESLint v10 landed in 16.

##### Converting the remaining eslintrc configs

The `@nx/eslint:convert-to-flat-config` generator does the conversion, so JSON and YAML configs are handled the same way the ESLint v9 migration handled them. JavaScript-based configs (`.eslintrc.js`, `.eslintrc.cjs`) are read statically, never executed: a config whose exported object is made of literals is converted like any other, and one that computes its values is reported instead of guessed at.

###### Before

```js
// .eslintrc.js
module.exports = {
  extends: ['../../.eslintrc.json'],
  overrides: [
    {
      files: ['*.ts'],
      rules: { '@typescript-eslint/no-explicit-any': 'error' },
    },
  ],
};
```

###### After

```js
// eslint.config.mjs
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
];
```

Comments in the original config are not carried over, since the converted file is generated from the config values rather than rewritten in place.

##### Replacing the plugins with no ESLint v10 release

`eslint-plugin-import`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react` peer-depend on ESLint v9 or lower and have no v10 release, and `eslint-plugin-react-hooks` only supports v10 from version 7. The migration removes the first three from `package.json`, installs `eslint-plugin-import-x` when `eslint-plugin-import` was there, and updates `eslint-plugin-react-hooks` to `7.1.1`.

Two of those removals lose rules outright. `eslint-plugin-import` has a maintained fork in `eslint-plugin-import-x`, so its rules move across, but `eslint-plugin-react` and `eslint-plugin-jsx-a11y` have no equivalent: every `react/` and `jsx-a11y/` rule the workspace was enforcing stops being enforced, and nothing is installed in their place. They are removed rather than left alone because no published release of either declares support for ESLint v10, so keeping them would leave the workspace on plugins its ESLint is outside the supported range of. A workspace that depends on those rules should stay on ESLint v9, which Nx still supports, and move to v10 once the plugins publish a release that supports it.

Workspaces that get these rules through an Nx preset (`@nx/eslint-plugin`'s `flat/react`, `flat/react-base` and `flat/react-jsx`) need no config change: the presets already resolve `eslint-plugin-import-x` and the classic react-hooks rules on ESLint v10, and they drop the react and jsx-a11y rules for the same reason.

A file ESLint loads as a config (`eslint.config.*`, `.eslintrc.*`) is reported for manual follow-up when it names one of the removed plugins or configures its rules through the `import/`, `react/` or `jsx-a11y/` prefix. Any other module is reported only when it imports one of them by package name, since a rule prefix in an ordinary source file is indistinguishable from an import path. Those references stop resolving once the package is gone, and only the `import` to `import-x` case has an equivalent to move to.

Source files are reported too, because a rule that is no longer defined cannot be referenced from a directive comment either: ESLint fails with `Definition for rule '...' was not found` on a leftover `/* eslint-disable react/no-danger */` or an inline `/* eslint import/no-cycle: "error" */`, so those comments have to be rewritten or dropped along with the plugin.

##### Checking the remaining plugins

Every installed dependency that declares a `peerDependencies.eslint` is checked against it, and the ones whose range rules the new ESLint out are reported so they can be updated or replaced. Declaring that peer is the signal rather than the package name, so packages like `typescript-eslint` and `angular-eslint` are covered too. The check is one-directional: a package that declares an open range such as `>=8`, or no ESLint peer at all, satisfies it without having been built for v10, so it is worth running lint before treating the workspace as done. It also reads those ranges from `node_modules`, so when the migration runs before the updated dependencies are installed it reports that the check was skipped rather than a clean result.

##### What is not changed

Source files are never edited, and no rule is turned off to make lint pass. ESLint v10 itself enforces nothing new: it ships the same rule set as v9, `@eslint/js` stays at the version the workspace already has, and `typescript-eslint` moves to 8.58, whose recommended set matches the 8.40 one the ESLint v9 migration installed.

Four things can still turn a workspace that linted cleanly on v9 red, and all four are reported rather than fixed:

- Directive comments naming a rule from a removed plugin. Removing the plugin removes its rules, and a directive for a rule ESLint cannot find is an error in its own right, so a `/* eslint-disable react/... */` left in source fails the lint run.
- `/* eslint-env */` comments. Flat config never read them; ESLint v9 warned that they would become errors, and v10 reports each one as `/* eslint-env */ comments are no longer supported`. The globals they declared have to move into the flat config or into a `/* global */` comment.
- A config that extends `eslint:recommended` and is converted here. The flat-config translation pulls the recommended set from `@eslint/js`, and a workspace that did not have that package yet gets its v10 release, whose recommended set enables three rules the v9 one did not: `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error`.
- A config that pulls `eslint-plugin-react-hooks`'s own `recommended` preset. Moving that plugin to v7 grows the preset from 2 rules to 16, adding the React Compiler set with 12 of them at error severity. Configs that reach the rules through `@nx/eslint-plugin`'s `flat/react`, `flat/react-base` or `flat/react-jsx` are unaffected: those pin `rules-of-hooks` and `exhaustive-deps` on ESLint v10.
