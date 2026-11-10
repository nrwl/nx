#### Prepare the workspace for ESLint v10

ESLint v10 removed the eslintrc configuration format and the `ESLINT_USE_FLAT_CONFIG` escape hatch, so ESLint no longer reads `.eslintrc.*` files itself. Only a flat config that loads one through `FlatCompat` still applies it. It also raised the Node.js floor to `^20.19.0 || ^22.13.0 || >=24`, and a few widely used plugins have no v10 release.

This migration runs when the workspace lands on ESLint v10. It converts the eslintrc configs that are left, replaces the plugins with no release that supports ESLint v10, and reports whatever it could not do safely so the paired prompt can finish it.

##### When the ESLint v10 update is held back

Some packages have releases that do not work on ESLint v10. The update to ESLint v10 is skipped for a workspace that declares one of those releases. Those workspaces stay on v9, which is still supported, until they update that package.

- `angular-eslint` and `@angular-eslint/eslint-plugin` below 21.3, the release that added ESLint v10 to their peer range. On Angular 21, the `@nx/angular` migrations move `angular-eslint` 21.0-21.2 to 21.3 in the same run, so the update goes ahead. Angular 20 workspaces stay on v9.
- `eslint-config-next` below 16.4, the first release whose bundled plugins work on ESLint v10. Versions 16.0-16.3 accept v10 in their peer range, but the React plugins they bundle fail on it. When `@nx/next` is installed, its migrations move 16.0-16.3 to 16.4 in the same run, so the update goes ahead. Next.js 15 and lower use `eslint-config-next` 15 or lower, so those workspaces stay on v9.
- `@nuxt/eslint-config` below 1.0, which `@nx/nuxt` installs for a workspace on eslintrc. Its peer range ends at ESLint v9.
- `eslint-plugin-vue` below 9 and `@vue/eslint-config-typescript` below 14. Their peer ranges end at ESLint v8.

##### Converting the remaining eslintrc configs

The `@nx/eslint:convert-to-flat-config` generator does the conversion, so JSON and YAML configs are handled the same way the ESLint v9 migration handled them. JavaScript-based configs (`.eslintrc.js`, `.eslintrc.cjs`) are read statically, never executed: a config whose exported object is made of literals is converted like any other, and one that computes its values is reported instead of guessed at.

The conversion runs only when the workspace root has no flat config yet. Otherwise the eslintrc files left in the workspace are reported, not converted. ESLint v10 does not read them, so the rules of one that no flat config loads through `FlatCompat` are not applied. If lint already ran on flat config before the update, those rules were already off, and converting the file can surface new lint errors.

Task inputs in `nx.json` and project configuration that name an eslintrc or `.eslintignore` file move to the flat config. `.eslintrc.base.json` becomes `eslint.base.config.*`. `.eslintrc`, `.eslintrc.json`, `.eslintrc.yaml`, `.eslintrc.yml`, `.eslintrc.js`, `.eslintrc.cjs` and `.eslintignore` become `eslint.config.*`. The input also keeps the old name while a file with that name is left in the workspace, and always for a glob or an `includeIgnored` fileset, so task hashes still cover the file. A `lint` target default that lists inputs also gets `{workspaceRoot}/eslint.config.*`, and a `production` named input gets `!{projectRoot}/eslint.config.*`.

Lint targets are converted too. When Nx 24 converted `@nx/eslint:lint` targets to inferred tasks, the eslintrc-only options `ignore-path`, `no-eslintrc`, `resolve-plugins-relative-to` and `rulesdir` stayed on the target, and flat config supports none of them. The conversion removes `no-eslintrc` from the project configuration of inferred lint targets and from the `targetDefaults` entries for `@nx/eslint/plugin`, and reports the other three. An `ignore-path` stays where it is, and so does the file it names. Moving its patterns into the flat config's `ignores` would apply them to every run of that config, including the editor and targets that never used the file. Pass them as `--ignore-pattern` flags in the `args` of the runs that used the file instead.

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

`eslint-plugin-import`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react` peer-depend on ESLint v9 or lower and have no v10 release. The migration removes them from `package.json` and installs `eslint-plugin-import-x` when `eslint-plugin-import` was there. `eslint-plugin-import-x` supports v10 from 4.16.2 and `eslint-plugin-react-hooks` from 7.1.0, so a workspace that declares an older release gets `eslint-plugin-import-x` `^4.17.1` or `eslint-plugin-react-hooks` `7.1.1`. A declaration the update cannot rewrite, such as `workspace:*`, is reported instead.

Two of those removals lose rules outright. `eslint-plugin-import` has a maintained fork in `eslint-plugin-import-x`, so its rules move across, but Nx installs no replacement for `eslint-plugin-react` and `eslint-plugin-jsx-a11y`: every `react/` and `jsx-a11y/` rule the workspace was enforcing stops being enforced. They are removed rather than left alone because no published release of either declares support for ESLint v10, so keeping them would leave the workspace on plugins its ESLint is outside the supported range of. A workspace that depends on those rules can stay on ESLint v9, which Nx still supports. Run `nx migrate <version> --include=required` to update only the Nx packages. ESLint and the other third-party packages Nx manages keep their versions, and this migration does not run. A later `nx migrate --include=optional` applies the updates that run deferred, including ESLint v10 and this migration.

On npm, the install that `nx migrate --run-migrations` runs before the migrations can fail with an `ERESOLVE` peer dependency error, because those plugins are still in `package.json` and their peer ranges exclude ESLint v10. Install once with `npm install --legacy-peer-deps`, then run `nx migrate --run-migrations --skip-install`. The migration then removes those plugins, so they no longer block later installs.

Workspaces that get these rules through an Nx preset (`@nx/eslint-plugin`'s `flat/react`, `flat/react-base` and `flat/react-jsx`) need no config change: the presets already resolve `eslint-plugin-import-x` and the classic react-hooks rules on ESLint v10, and they drop the react and jsx-a11y rules for the same reason.

The migration reports, for manual follow-up:

- A JavaScript or TypeScript file, config or not, that imports one of the removed plugins by package name, through `import`, `export ... from`, `require`, `require.resolve` or `import()`.
- An eslintrc file still in the workspace that names one of them, extends one of their configs (`plugin:react/recommended`), or configures their rules through the `import/`, `react/` or `jsx-a11y/` prefix.

A flat config that names a removed plugin's rule or `plugin:` config without importing the plugin is not reported. ESLint reports it when it lints a file with that config: `Could not find plugin` for a rule, and `Failed to load plugin` for a `plugin:` config loaded through `FlatCompat`. Only the `import` to `import-x` case has an equivalent to move to. `eslint-plugin-import-x` reads only its own `import-x/` settings, so `import/resolver` and the other `import/` settings keys have to be renamed too.

Directive comments need the same cleanup, because a rule that is no longer defined cannot be referenced from one either. ESLint fails with `Definition for rule '...' was not found` on a leftover `/* eslint-disable react/no-danger */` or an inline `/* eslint import/no-cycle: "error" */`. The migration reads the comments of each JavaScript and TypeScript file from its TypeScript parse, and treats them the way ESLint does: block comments, plus line comments for `eslint-disable-line` and `eslint-disable-next-line`.

- It reports every directive comment that names a rule of a removed plugin, and leaves it as it is. Another config can still register the plugin: `eslint-config-expo`, for one, registers `eslint-plugin-react` from its own dependencies. Whether an `import/` rule moves to `eslint-plugin-import-x` depends on the rule and on the key the config registers the fork under.
- It deletes one comment: the `/* eslint-disable jsx-a11y/accessible-emoji */` line Nx generated at the top of the Expo and React Native welcome page, when it removed `eslint-plugin-jsx-a11y`. That plugin deprecated the rule, and none of its presets enable it.
- It checks no directive comment when a `package.json` declares `eslint-config-next`, which registers all three plugins itself (see Next.js configs below).

Lint reports what is left in the files a lint target covers. The migration does not read other file types, such as `.vue` files, or files git ignores.

##### Next.js configs

`eslint-config-next` registers `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import` from its own dependencies, and its 16.4 release supports ESLint v10. A config that spreads it keeps their `react/`, `jsx-a11y/` and `import/` rules. The migration does not work out which files such a config lints, so when any `package.json` declares `eslint-config-next`, it does not report directive comments. Lint reports the ones that no longer resolve.

The same holds for the two shapes Nx generated for Next.js apps: registering the `@next/next` plugin and extending `next` through `FlatCompat`. The `@nx/next` migrations for this release replace those entries with a spread of `eslint-config-next/core-web-vitals`, or list the configs they could not update. They also move `eslint-config-next` and `@next/eslint-plugin-next` from 16.0-16.3 to `^16.4.0`. On Next.js 16 or later, they move `@next/eslint-plugin-next` 14 and 15 to `^16.4.0` too.

When another config may register one of those plugins, the `@nx/next` migration uses the `core-web-vitals` config of `@next/eslint-plugin-next` instead, because ESLint rejects a different copy of a plugin another config already registered. The two may be the same copy, which ESLint accepts. That config registers only `@next/next`. The `react/`, `jsx-a11y/` and `import/` rules of a config that uses it, and the ones named in directive comments of the files it lints, fail unless another config registers the plugin.

A Next.js config is reported like any other when it imports one of the removed plugins.

##### Checking the remaining plugins

Every dependency in the root `package.json` that declares a `peerDependencies.eslint` is checked against it, and the ones whose range rules the new ESLint out are reported so they can be updated or replaced. Declaring that peer is the signal rather than the package name, so packages like `typescript-eslint` and `angular-eslint` are covered too. A plugin declared only in a project's `package.json` is not checked. The check is one-directional: a package that declares an open range such as `>=8`, or no ESLint peer at all, satisfies it without having been built for v10, so it is worth running lint before treating the workspace as done. It also reads those ranges from `node_modules`, so when the migration runs before the updated dependencies are installed it reports that the check was skipped rather than a clean result.

##### What is not changed

The migration code never turns a rule off to make lint pass. The only source edit it makes is deleting the generated `jsx-a11y/accessible-emoji` comment described above.

The paired prompt edits source files in two cases: it rewrites or deletes a directive comment that lint reports as naming a rule ESLint can no longer find, and it replaces an `/* eslint-env */` comment by moving its globals into the flat config or a `/* global */` comment. The only rules it turns off are the ones a changed preset newly enables, listed below, and it does that in the flat config. ESLint v10 itself enforces nothing new: it ships the same rule set as v9. `@eslint/js` stays at the declared version unless the conversion adds it (see below), and `typescript-eslint` moves to 8.58, whose recommended set matches the 8.40 one the ESLint v9 migration installed.

Five things can still turn a workspace that linted cleanly on v9 red, and the migration reports each one rather than fixing it:

- Directive comments naming a rule from a removed plugin. A directive for a rule ESLint cannot find is an error in its own right, so lint fails while one is left. In a workspace that declares `eslint-config-next`, only lint reports them.
- `/* eslint-env */` comments. ESLint v9 applied them only on eslintrc and warned about them on flat config, and v10 reports each one as `/* eslint-env */ comments are no longer supported`. The globals they declared have to move into the flat config or into a `/* global */` comment.
- A config that extends `eslint:recommended` and is converted here, or that a converted config loads through `FlatCompat`. The flat-config translation pulls the recommended set from `@eslint/js`, and a workspace that did not have that package yet gets its v10 release, whose recommended set enables three rules the v9 one did not: `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error`.
- A lint target that still carries `ignore-path`, `rulesdir`, `resolve-plugins-relative-to`, or a `no-eslintrc` the conversion did not remove. ESLint v10 rejects `ignore-path`, `no-eslintrc` and `resolve-plugins-relative-to` as invalid options. `rulesdir` never reaches ESLint, so the rules in its directory are not loaded.
- A config that pulls `eslint-plugin-react-hooks`'s own `recommended` preset. Moving that plugin to v7 grows the preset from 2 rules to 16, adding the React Compiler set with 12 of them at error severity. Configs that reach the rules through `@nx/eslint-plugin`'s `flat/react` or `flat/react-jsx` are unaffected: those pin `rules-of-hooks` and `exhaustive-deps` on ESLint v10.
