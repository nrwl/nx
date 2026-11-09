#### Prepare the workspace for ESLint v10

ESLint v10 removed the eslintrc configuration format and the `ESLINT_USE_FLAT_CONFIG` escape hatch, so `.eslintrc.*` files are no longer read at all. It also raised the Node.js floor to `^20.19.0 || ^22.13.0 || >=24`, and a few widely used plugins have no v10 release.

This migration runs when the workspace lands on ESLint v10. It converts the eslintrc configs that are left, replaces the plugins with no release that supports ESLint v10, and reports whatever it could not do safely so the paired prompt can finish it.

##### When the ESLint v10 update is held back

Two framework integrations pin ESLint v9 through their own peer ranges, so the update to ESLint v10 is skipped for a workspace that has either of them. Those workspaces stay on v9, which is still supported, until they upgrade to Angular 21 or Next.js 16.

- `angular-eslint` below 21.3, the release that added ESLint v10 to its peer range. On Angular 21, the `@nx/angular` migrations move `angular-eslint` 21.0-21.2 to 21.3 in the same run, so the update goes ahead. Angular 20 workspaces stay on v9.
- `eslint-config-next` v15 and lower, which Next.js 15 and lower use. Versions 16.0-16.3 do not hold the update back, and the `@nx/next` migrations move them to 16.4 (see Next.js configs below).

##### Converting the remaining eslintrc configs

The `@nx/eslint:convert-to-flat-config` generator does the conversion, so JSON and YAML configs are handled the same way the ESLint v9 migration handled them. JavaScript-based configs (`.eslintrc.js`, `.eslintrc.cjs`) are read statically, never executed: a config whose exported object is made of literals is converted like any other, and one that computes its values is reported instead of guessed at.

Lint targets are converted too. When Nx 24 converted `@nx/eslint:lint` targets to inferred tasks, the eslintrc-only options `ignore-path`, `no-eslintrc`, `resolve-plugins-relative-to` and `rulesdir` stayed on the target, and flat config supports none of them. The conversion moves the patterns of an `ignore-path` file into the flat config's `ignores` when the option applies to every run of the target, and removes `no-eslintrc`, in project configuration and in the `targetDefaults` entries for `@nx/eslint/plugin`. A moved file is deleted only when its name contains `eslintignore` and no remaining option names it, so a `.gitignore` stays. `rulesdir` and `resolve-plugins-relative-to` have no flat-config option to move to, so they are reported, as is an `ignore-path` another one replaces for some runs, such as one under a configuration.

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

const eslintConfig = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
];

export default eslintConfig;
```

Comments in the original config are not carried over, since the converted file is generated from the config values rather than rewritten in place.

##### Replacing the plugins with no ESLint v10 release

`eslint-plugin-import`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react` peer-depend on ESLint v9 or lower and have no v10 release. The migration removes them from `package.json` and installs `eslint-plugin-import-x` when `eslint-plugin-import` was there. `eslint-plugin-import-x` supports v10 from 4.16.2 and `eslint-plugin-react-hooks` from 7.1.0, so a workspace that declares an older release gets `eslint-plugin-import-x` `^4.17.1` or `eslint-plugin-react-hooks` `7.1.1`.

Two of those removals lose rules outright. `eslint-plugin-import` has a maintained fork in `eslint-plugin-import-x`, so its rules move across, but `eslint-plugin-react` and `eslint-plugin-jsx-a11y` have no equivalent: every `react/` and `jsx-a11y/` rule the workspace was enforcing stops being enforced, and nothing is installed in their place. They are removed rather than left alone because no published release of either declares support for ESLint v10, so keeping them would leave the workspace on plugins its ESLint is outside the supported range of. A workspace that depends on those rules can stay on ESLint v9, which Nx still supports. Run `nx migrate <version> --include=required` to update only the Nx packages. ESLint and the other third-party packages Nx manages keep their versions, and this migration does not run. A later `nx migrate --include=optional` applies the updates that run deferred, including ESLint v10 and this migration.

On npm, the install that `nx migrate --run-migrations` runs before the migrations can fail with an `ERESOLVE` peer dependency error, because those plugins are still in `package.json` and their peer ranges exclude ESLint v10. Install once with `npm install --legacy-peer-deps`, then run `nx migrate --run-migrations --skip-install`. The migration then removes those plugins, so they no longer block later installs.

Workspaces that get these rules through an Nx preset (`@nx/eslint-plugin`'s `flat/react`, `flat/react-base` and `flat/react-jsx`) need no config change: the presets already resolve `eslint-plugin-import-x` and the classic react-hooks rules on ESLint v10, and they drop the react and jsx-a11y rules for the same reason.

A file ESLint loads as a config (`eslint.config.*`, `.eslintrc.*`) is reported for manual follow-up when it names one of the removed plugins, extends one of their configs (`plugin:react/recommended`), or configures their rules through the `import/`, `react/` or `jsx-a11y/` prefix. Next.js configs are the exception described below. Any other module is reported only when it imports one of them by package name, since a rule prefix in an ordinary source file is indistinguishable from an import path. Those references stop resolving once the package is gone, and only the `import` to `import-x` case has an equivalent to move to.

Source files are reported too, because a rule that is no longer defined cannot be referenced from a directive comment either: ESLint fails with `Definition for rule '...' was not found` on a leftover `/* eslint-disable react/no-danger */` or an inline `/* eslint import/no-cycle: "error" */`, so those comments have to be rewritten or dropped along with the plugin.

##### Next.js configs

`eslint-config-next` registers `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import` from its own dependencies, and its 16.4 release supports ESLint v10. A config that spreads it keeps their `react/`, `jsx-a11y/` and `import/` rules, so the migration does not report those rules there, or in the directive comments of the files that config lints.

The same holds for the two shapes Nx generated for Next.js apps: registering the `@next/next` plugin and extending `next` through `FlatCompat`. The `@nx/next` migrations for this release replace those entries with a spread of `eslint-config-next/core-web-vitals`, or list the configs they could not update. They also move `eslint-config-next` and `@next/eslint-plugin-next` from 16.0-16.3 to `^16.4.0`. On Next.js 16 or later, they move `@next/eslint-plugin-next` 14 and 15 to `^16.4.0` too.

When another config registers one of those plugins, the `@nx/next` migration uses the `core-web-vitals` config of `@next/eslint-plugin-next` instead, because ESLint rejects a second copy of a plugin. That config registers only `@next/next`, so this exemption does not cover it. Its `react/`, `jsx-a11y/` and `import/` rules, and the ones named in directive comments of the files it lints, fail unless another config registers the plugin.

A Next.js config is still reported when it imports one of the removed plugins directly or extends a `plugin:react/`, `plugin:jsx-a11y/` or `plugin:import/` config.

##### Checking the remaining plugins

Every dependency in the root `package.json` that declares a `peerDependencies.eslint` is checked against it, and the ones whose range rules the new ESLint out are reported so they can be updated or replaced. Declaring that peer is the signal rather than the package name, so packages like `typescript-eslint` and `angular-eslint` are covered too. A plugin declared only in a project's `package.json` is not checked. The check is one-directional: a package that declares an open range such as `>=8`, or no ESLint peer at all, satisfies it without having been built for v10, so it is worth running lint before treating the workspace as done. It also reads those ranges from `node_modules`, so when the migration runs before the updated dependencies are installed it reports that the check was skipped rather than a clean result.

##### What is not changed

The migration code never edits a source file or turns a rule off to make lint pass. The paired prompt edits source files in two cases: it rewrites or deletes a directive comment that names a rule ESLint can no longer find, and it replaces an `/* eslint-env */` comment by moving its globals into the flat config. The only rules it turns off are the ones a changed preset newly enables, listed below, and it does that in the flat config. ESLint v10 itself enforces nothing new: it ships the same rule set as v9, `@eslint/js` stays at the version the workspace already has, and `typescript-eslint` moves to 8.58, whose recommended set matches the 8.40 one the ESLint v9 migration installed.

Five things can still turn a workspace that linted cleanly on v9 red, and all five are reported rather than fixed:

- Directive comments naming a rule from a removed plugin. Removing the plugin removes its rules, and a directive for a rule ESLint cannot find is an error in its own right, so a `/* eslint-disable react/... */` left in source fails the lint run.
- `/* eslint-env */` comments. Flat config never read them; ESLint v9 warned that they would become errors, and v10 reports each one as `/* eslint-env */ comments are no longer supported`. The globals they declared have to move into the flat config or into a `/* global */` comment.
- A config that extends `eslint:recommended` and is converted here, or that a converted config loads through `FlatCompat`. The flat-config translation pulls the recommended set from `@eslint/js`, and a workspace that did not have that package yet gets its v10 release, whose recommended set enables three rules the v9 one did not: `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error`.
- A lint target that still carries `rulesdir`, `resolve-plugins-relative-to`, an `ignore-path` the conversion did not move, or a `no-eslintrc` it did not remove. ESLint v10 rejects `ignore-path`, `no-eslintrc` and `resolve-plugins-relative-to` as invalid options. `rulesdir` never reaches ESLint, so the rules in its directory are not loaded.
- A config that pulls `eslint-plugin-react-hooks`'s own `recommended` preset. Moving that plugin to v7 grows the preset from 2 rules to 16, adding the React Compiler set with 12 of them at error severity. Configs that reach the rules through `@nx/eslint-plugin`'s `flat/react`, `flat/react-base` or `flat/react-jsx` are unaffected: those pin `rules-of-hooks` and `exhaustive-deps` on ESLint v10.
