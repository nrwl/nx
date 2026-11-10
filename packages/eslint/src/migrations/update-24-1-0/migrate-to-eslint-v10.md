#### Prepare the workspace for ESLint v10

ESLint v10 removed the eslintrc configuration format and the `ESLINT_USE_FLAT_CONFIG` escape hatch, so `.eslintrc.*` files are no longer read at all. It also raised the Node.js floor to `^20.19.0 || ^22.13.0 || >=24`, and a few widely used plugins have no v10 release.

This migration runs when the workspace lands on ESLint v10. It converts the eslintrc configs that are left, replaces the plugins with no release that supports ESLint v10, and reports whatever it could not do safely so the paired prompt can finish it.

##### When the ESLint v10 update is held back

Two framework integrations pin ESLint v9 through their own peer ranges, so the update to ESLint v10 is skipped for a workspace that has either of them. Those workspaces stay on v9, which is still supported, until they upgrade to Angular 21 or Next.js 16.

- `angular-eslint` below 21.3, the release that added ESLint v10 to its peer range. On Angular 21, the `@nx/angular` migrations move `angular-eslint` 21.0-21.2 to 21.3 in the same run, so the update goes ahead. Angular 20 workspaces stay on v9.
- `eslint-config-next` v15 and lower, which Next.js 15 and lower use. Versions 16.0-16.3 do not hold the update back, and the `@nx/next` migrations move them to 16.4 (see Next.js configs below).

##### Converting the remaining eslintrc configs

The `@nx/eslint:convert-to-flat-config` generator does the conversion, so JSON and YAML configs are handled the same way the ESLint v9 migration handled them. JavaScript-based configs (`.eslintrc.js`, `.eslintrc.cjs`) are read statically, never executed: a config whose exported object is made of literals is converted like any other, and one that computes its values is reported instead of guessed at.

The conversion runs only when the workspace root has no flat config yet. Otherwise the eslintrc files left in the workspace are reported, not converted:

- Under an `eslint.config.*` file at the root, ESLint v9 already ignored them, unless lint ran with `ESLINT_USE_FLAT_CONFIG=false`.
- Under a root base config alone, such as `eslint.base.config.mjs`, the Nx lint target of a project whose config is an eslintrc file ran ESLint v9 with `ESLINT_USE_FLAT_CONFIG=false`. Their rules stop applying with this run.

Task inputs in `nx.json` and project configuration that name an eslintrc or `.eslintignore` file move to the flat config: `.eslintrc.base.json` becomes `eslint.base.config.*`, and the other eslintrc names and `.eslintignore` become `eslint.config.*`. While a file with the old name is left in the workspace, the input keeps that name as well, so task hashes still cover the file. A `lint` target default that lists inputs also gets `{workspaceRoot}/eslint.config.*`, and a `production` named input gets `!{projectRoot}/eslint.config.*`.

Lint targets are converted too. When Nx 24 converted `@nx/eslint:lint` targets to inferred tasks, the eslintrc-only options `ignore-path`, `no-eslintrc`, `resolve-plugins-relative-to` and `rulesdir` stayed on the target, and flat config supports none of them. The conversion removes `no-eslintrc`, in project configuration and in the `targetDefaults` entries for `@nx/eslint/plugin`, and reports the other three. An `ignore-path` stays where it is, and so does the file it names. Moving its patterns into the flat config's `ignores` would apply them to every run of that config, including the editor and targets that never used the file. Pass them as `--ignore-pattern` flags in the `args` of the runs that used the file instead.

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

The migration reports, for manual follow-up:

- A JavaScript or TypeScript file, config or not, that imports one of the removed plugins by package name, through `import`, `export ... from`, `require`, `require.resolve` or `import()`.
- An eslintrc file still in the workspace that names one of them, extends one of their configs (`plugin:react/recommended`), or configures their rules through the `import/`, `react/` or `jsx-a11y/` prefix.

A flat config that names a removed plugin's rule or `plugin:` config without importing the plugin is not reported. ESLint reports it when it lints a file with that config: `Could not find plugin` for a rule, and `Failed to load plugin` for a `plugin:` config loaded through `FlatCompat`. Only the `import` to `import-x` case has an equivalent to move to. `eslint-plugin-import-x` reads only its own `import-x/` settings, so `import/resolver` and the other `import/` settings keys have to be renamed too.

Directive comments need the same cleanup, because a rule that is no longer defined cannot be referenced from one either. ESLint fails with `Definition for rule '...' was not found` on a leftover `/* eslint-disable react/no-danger */` or an inline `/* eslint import/no-cycle: "error" */`. The migration reads the comments of each JavaScript and TypeScript file from its TypeScript parse, and treats them the way ESLint does: block comments, plus line comments for `eslint-disable-line` and `eslint-disable-next-line`.

- When it removed `eslint-plugin-react` or `eslint-plugin-jsx-a11y` and no `package.json` declares `eslint-config-next`, it removes their rules from `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` and `eslint-enable` comments. It deletes a comment left with no rule, unless another comment ends on the nearest non-blank line above it (see What is not changed). Those directives suppress nothing once the rule is gone.
- It reports an `import/` rule in those comments, and a removed plugin's rule set through an inline `/* eslint ... */` comment. Whether an `import/` rule moves to `eslint-plugin-import-x` depends on the rule and on the key the config registers the fork under.
- It checks no directive comment when a `package.json` declares `eslint-config-next`, which registers all three plugins itself (see Next.js configs below).

Lint reports what is left in the files a lint target covers. The migration does not read other file types, such as `.vue` files, or files git ignores.

##### Next.js configs

`eslint-config-next` registers `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import` from its own dependencies, and its 16.4 release supports ESLint v10. A config that spreads it keeps their `react/`, `jsx-a11y/` and `import/` rules. The migration does not work out which files such a config lints, so when any `package.json` declares `eslint-config-next`, it leaves every directive comment as it is. Lint reports the ones that no longer resolve.

The same holds for the two shapes Nx generated for Next.js apps: registering the `@next/next` plugin and extending `next` through `FlatCompat`. The `@nx/next` migrations for this release replace those entries with a spread of `eslint-config-next/core-web-vitals`, or list the configs they could not update. They also move `eslint-config-next` and `@next/eslint-plugin-next` from 16.0-16.3 to `^16.4.0`. On Next.js 16 or later, they move `@next/eslint-plugin-next` 14 and 15 to `^16.4.0` too.

When another config registers one of those plugins, the `@nx/next` migration uses the `core-web-vitals` config of `@next/eslint-plugin-next` instead, because ESLint rejects a second copy of a plugin. That config registers only `@next/next`. The `react/`, `jsx-a11y/` and `import/` rules of a config that uses it, and the ones named in directive comments of the files it lints, fail unless another config registers the plugin.

A Next.js config is reported like any other when it imports one of the removed plugins.

##### Checking the remaining plugins

Every dependency in the root `package.json` that declares a `peerDependencies.eslint` is checked against it, and the ones whose range rules the new ESLint out are reported so they can be updated or replaced. Declaring that peer is the signal rather than the package name, so packages like `typescript-eslint` and `angular-eslint` are covered too. A plugin declared only in a project's `package.json` is not checked. The check is one-directional: a package that declares an open range such as `>=8`, or no ESLint peer at all, satisfies it without having been built for v10, so it is worth running lint before treating the workspace as done. It also reads those ranges from `node_modules`, so when the migration runs before the updated dependencies are installed it reports that the check was skipped rather than a clean result.

##### What is not changed

The migration code never turns a rule off to make lint pass. It edits source files in two cases. It removes the `react/` and `jsx-a11y/` rules from disable and enable directives under the conditions above. It deletes `/* eslint-env */` comments when the workspace had no eslintrc config before the run: no `.eslintrc.*` file and no `eslintConfig` in a `package.json`. Flat config never applied the globals those comments declared, so deleting them changes nothing ESLint enforced. A workspace that forced the eslintrc format with `ESLINT_USE_FLAT_CONFIG=false` did apply them, and has to declare those globals in its flat config.

Neither edit removes or empties a line right under another comment. When a comment ends on the nearest non-blank line above, the migration leaves the comment in place and reports it. Removing its line would put the code below under an `eslint-disable-next-line` or `@ts-ignore` there, and `@ts-ignore` also skips blank lines.

The paired prompt edits source files in two cases: it rewrites or deletes a directive comment that names a rule ESLint can no longer find, and it replaces an `/* eslint-env */` comment by moving its globals into the flat config. The only rules it turns off are the ones a changed preset newly enables, listed below, and it does that in the flat config. ESLint v10 itself enforces nothing new: it ships the same rule set as v9, `@eslint/js` stays at the version the workspace already has, and `typescript-eslint` moves to 8.58, whose recommended set matches the 8.40 one the ESLint v9 migration installed.

Six things can still turn a workspace that linted cleanly on v9 red, and the migration reports each one rather than fixing it:

- Directive comments naming a rule from a removed plugin that the migration left in place: an `import/` rule, a rule set through an inline `/* eslint ... */` comment, and every directive in a workspace that declares `eslint-config-next`. A directive for a rule ESLint cannot find is an error in its own right, so lint fails while one is left.
- `/* eslint-env */` comments in a workspace that had an eslintrc config before the run. Flat config never read them; ESLint v9 warned that they would become errors, and v10 reports each one as `/* eslint-env */ comments are no longer supported`. The globals they declared have to move into the flat config or into a `/* global */` comment.
- Comments the migration would delete but left under another comment, as described above: `/* eslint-env */` comments, and directives naming only `react/` and `jsx-a11y/` rules. ESLint v10 reports both as errors. Delete each one by hand, then check what the comment above it applies to.
- A config that extends `eslint:recommended` and is converted here, or that a converted config loads through `FlatCompat`. The flat-config translation pulls the recommended set from `@eslint/js`, and a workspace that did not have that package yet gets its v10 release, whose recommended set enables three rules the v9 one did not: `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error`.
- A lint target that still carries `ignore-path`, `rulesdir`, `resolve-plugins-relative-to`, or a `no-eslintrc` the conversion did not remove. ESLint v10 rejects `ignore-path`, `no-eslintrc` and `resolve-plugins-relative-to` as invalid options. `rulesdir` never reaches ESLint, so the rules in its directory are not loaded.
- A config that pulls `eslint-plugin-react-hooks`'s own `recommended` preset. Moving that plugin to v7 grows the preset from 2 rules to 16, adding the React Compiler set with 12 of them at error severity. Configs that reach the rules through `@nx/eslint-plugin`'s `flat/react`, `flat/react-base` or `flat/react-jsx` are unaffected: those pin `rules-of-hooks` and `exhaustive-deps` on ESLint v10.
