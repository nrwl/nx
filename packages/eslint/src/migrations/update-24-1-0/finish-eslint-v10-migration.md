# ESLint v10 Migration Instructions for LLM

## Overview

These instructions guide you through finishing the migration of an Nx workspace to ESLint v10.

ESLint v10 removed the eslintrc configuration format. Unlike v9, where `.eslintrc.*` still worked behind `ESLINT_USE_FLAT_CONFIG=false`, v10 has no escape hatch: ESLint no longer reads an eslintrc file itself, and only a flat config that loads one through `FlatCompat` still applies it. v10 also raised the Node.js floor to `^20.19.0 || ^22.13.0 || >=24`, and `eslint-plugin-import`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react` have no v10 release.

The migration runs in two halves:

1. A deterministic pre-pass that converted the eslintrc configs it could read and replaced the plugins with no release that supports ESLint v10.
2. This prompt: finish what the pre-pass could not do safely, and leave the workspace lint-passing.

Out of scope: changing what rules the workspace enforces beyond what the removed plugins force, and upgrading any package other than the ESLint plugins named here. Source files are edited only for the cases named in sections 2, 3 and 6: directive comments naming a rule that no longer exists or that section 6 renames, and `/* eslint-env */` comments.

<pre_pass_summary note="a deterministic pre-pass already applied these edits; verify the new shape is in place rather than redoing them">

The pre-pass changed, mechanically:

- When the workspace root had no flat config yet, converted the remaining eslintrc configs to flat config through the `@nx/eslint:convert-to-flat-config` generator. JavaScript-based configs (`.eslintrc.js`, `.eslintrc.cjs`) are read statically, so the ones built from literal values were converted too.
- In that conversion, removed `no-eslintrc` from the project configuration of inferred lint targets, except in projects whose config it skipped, and from the nx.json `targetDefaults` entries for `@nx/eslint/plugin`. It left every `ignore-path` option, every file one names, and every flag in `args` in place.
- Removed `eslint-plugin-import`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react` from `package.json` and installed `eslint-plugin-import-x` in place of `eslint-plugin-import`. Updated a declared `eslint-plugin-import-x` below 4.16.2 and `eslint-plugin-react-hooks` below 7.1.0, the first releases that support ESLint v10. An `eslint-plugin-react-hooks` that moved from v6 or older to v7 also enables the React Compiler rules in its `recommended` preset.
- Deleted the `/* eslint-disable jsx-a11y/accessible-emoji */` line Nx generated at the top of the Expo and React Native welcome page, when it removed `eslint-plugin-jsx-a11y` and no `package.json` declares `eslint-config-next`. It edited no other comment.

The pre-pass also detected and reported, without changing anything:

- eslintrc files still in the workspace.
- JavaScript and TypeScript files that import a removed plugin, and eslintrc files still in the workspace that name one.
- Source files whose directive comments name a rule of a removed plugin (`import/`, `react/`, `jsx-a11y/`), including the inline form (`/* eslint react/no-danger: "error" */`). It checks no directive comment when a `package.json` declares `eslint-config-next`, which registers those plugins itself.
- Source files carrying `/* eslint-env */` comments. ESLint v10 reports each one as an error.
- An `eslint-plugin-import-x` or `eslint-plugin-react-hooks` declaration it could not rewrite, such as `workspace:*` or a dist tag.
- Installed dependencies whose `peerDependencies.eslint` rules out the ESLint the workspace now runs.
- A newly added `@eslint/js`, whose recommended set is wider than the one the eslintrc config applied.
- Lint targets that still carry an eslintrc-only ESLint option, as an option or as a flag in `args`: `ignore-path`, `rulesdir`, `resolve-plugins-relative-to`, or a `no-eslintrc` it did not remove.

The pre-pass does NOT:

- Convert an eslintrc config whose values are computed at runtime (a `require` call, a template with substitutions, `__dirname`, a conditional). It never executes the file, so it reports those instead of guessing.
- Rewrite a config that references a removed plugin, or edit a directive comment other than the generated one above. Another config can still register a removed plugin (`eslint-config-expo` registers `eslint-plugin-react`), and whether a rule moves to `eslint-plugin-import-x` depends on the rule and on the key the config registers the fork under.
- Replace an `/* eslint-env */` comment. It cannot tell whether an eslintrc config applied the comment's globals before this run, and deciding where they belong is a judgment call.
- Scan files other than JavaScript and TypeScript source for imports and directive comments, such as `.vue` files, or read files git ignores.
- Clear a plugin for ESLint v10. Its peer scan only catches the packages whose declared range rules v10 out; an open range such as `>=8` admits v10 whether or not the package works on it.
- Verify that lint still passes.

What the pre-pass found reaches you in the pre-pass report. In an `nx migrate` run, the report is either the `agentContext` list in the `impl` of your `nx_migrate_prompt` block, or an `<agent_context>` block in the `nx migrate` output. There is no report when you were handed this file without either. In the `nx_migrate_prompt` block, `impl.changes` lists the files the pre-pass wrote. Verify the new shape is in place; do not re-apply the same edit.

The report's first entry starts with `Pre-pass scan results:` and gives one result per scan:

- `none`: the scan ran and found nothing, so skip the search it covers.
- `reported below`: a later entry lists what the scan found.
- `not run, <reason>`: the scan did not run, so do its search yourself.

Every later entry is pending work. Address each one in the relevant section below.

The scans never cover these, so check them whatever the report says:

- Files other than JavaScript and TypeScript source, such as `.vue` files, and files git ignores.
- ESLint plugins the root `package.json` does not declare, such as those a project's `package.json` declares.
- Packages whose ESLint peer range is open, such as `>=8`, or that declare no ESLint peer.
- Node.js versions set anywhere but the root `package.json`, such as in CI and container images.

When there is no report, run every search the sections below describe.

</pre_pass_summary>

<handoff_guidance>
In your handoff `summary` (1 to 3 sentences per the system prompt), name the sections you applied and explicitly call out any you skipped because they did not apply (for example "no JavaScript-based configs left and no references to the removed plugins").
</handoff_guidance>

## Pre-Migration Checklist

1. **Confirm the ESLint version is v10**:

   ```bash
   npx eslint --version
   ```

   If it reports v9 or lower, make no changes and stop: this prompt only applies once the workspace is on v10.

2. **Locate all ESLint config files**:
   - Flat configs: `eslint.config.{mjs,cjs,js,mts,cts,ts}` and `eslint.base.config.*` at the root and in each project.
   - Any remaining eslintrc files: `.eslintrc`, `.eslintrc.json`, `.eslintrc.yaml`, `.eslintrc.yml`, `.eslintrc.js`, `.eslintrc.cjs`, and the `.eslintrc.base.*` files.

3. **Rewrite the configs that import a removed plugin before you run any `nx` command**, as section 2 describes. `@nx/eslint/plugin` loads every ESLint config to infer the lint targets, so one config that fails to load fails the project graph, and every `nx` command with it. The pre-pass report lists the configs that import one through a string literal. Also search the ESLint configs for `eslint-plugin-import`, `eslint-plugin-react` and `eslint-plugin-jsx-a11y`, which finds a config that loads one through a variable.

## 1. Convert the eslintrc configs the pre-pass could not read

**Search pattern**: the `.eslintrc.*` files the pre-pass report lists.

**What changed**: ESLint v10 does not read eslintrc files. A file left behind is not an error, it is silently ignored, so the rules it holds stop being enforced.

The exception is a file a flat config loads through `FlatCompat`, with `compat.extends` or the `extends` of a file loaded that way. The pre-pass loads this way any local eslintrc that a converted config extends but the run did not convert, such as a shared config outside any project. Such a file still applies, so it can stay. To fold one in anyway, convert it to a module the loading configs import, and remove the `compat.extends` entry that loads it.

Some leftovers may already have been dormant before this migration: if lint ran on flat config before this run, ESLint v9 did not apply them either. Folding a dormant file in turns rules back on that the workspace has not been running, so expect new errors there and keep them separate in your summary from the enforcement this migration actually dropped. A root with only a base config, such as `eslint.base.config.mjs`, does not make them dormant, and the pre-pass report says when the pre-pass skipped the conversion for that reason. The inferred lint target of a project whose config is an eslintrc file runs ESLint with `ESLINT_USE_FLAT_CONFIG=false`, so ESLint v9 applied those files.

Convert each of the other files to a flat config next to it, mirroring the shape of the configs the pre-pass produced.

**Before:**

```js
// .eslintrc.js
const tsconfigRootDir = __dirname;

module.exports = {
  extends: ['../../.eslintrc.json'],
  overrides: [
    {
      files: ['*.ts'],
      parserOptions: { tsconfigRootDir },
      rules: { '@typescript-eslint/no-floating-promises': 'error' },
    },
  ],
};
```

**After:**

```js
// eslint.config.mjs
import baseConfig from '../../eslint.config.mjs';

const eslintConfig = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
];

export default eslintConfig;
```

**Action items**:

- [ ] Convert each reported config to `eslint.config.mjs`, preserving its rules, plugins, parser options and overrides.
- [ ] Translate eslintrc keys to their flat-config equivalents: `env` to `languageOptions.globals`, `parser` / `parserOptions` to `languageOptions`, `ignorePatterns` to `ignores`, `overrides` entries to separate config objects with a `files` key.
- [ ] Widen the eslintrc glob semantics: `*.ts` in eslintrc matches at any depth, so it becomes `**/*.ts` in flat config.
- [ ] Delete the original eslintrc file once the flat config replaces it.
- [ ] Update any `nx.json` or `project.json` input that referenced the old file name. The pre-pass keeps a legacy input, such as `!{projectRoot}/.eslintrc.json`, while a file it can match is left. Once you delete the last such file, remove the legacy input and keep its flat-config counterpart.

## 2. Rewrite references to the removed plugins

**Search pattern**: the files the pre-pass report lists, plus `eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, and the `import/`, `react/`, `jsx-a11y/` rule prefixes across all ESLint configs. The pre-pass only finds the JavaScript configs that import a removed plugin through a string literal, not the ones that load it through a variable or only configure its rules.

**What changed**: those three plugins have no ESLint v10 release, so the pre-pass removed them from `package.json`. A config that still imports one, registers it under `plugins`, extends one of its configs (`plugin:react/recommended`), or configures its rules now fails to load with `Could not find plugin` or a module resolution error.

`eslint-plugin-import` has a maintained fork, `eslint-plugin-import-x`, which the pre-pass installed. Its plugin key and rule prefix are both `import-x`.

**Before:**

```js
import importPlugin from 'eslint-plugin-import';

export default [
  {
    plugins: { import: importPlugin },
    rules: { 'import/no-cycle': 'error' },
  },
];
```

**After:**

```js
import importX from 'eslint-plugin-import-x';

export default [
  {
    plugins: { 'import-x': importX },
    rules: { 'import-x/no-cycle': 'error' },
  },
];
```

`eslint-plugin-react` and `eslint-plugin-jsx-a11y` have no release that supports ESLint v10, and Nx installs no replacement. Delete their plugin registrations and the rules that use their prefixes; do not look for a replacement package. Leave their rules alone in a config where another package still registers the plugin, such as a config that spreads `eslint-config-expo`, which registers `eslint-plugin-react` from its own dependencies.

**Action items**:

- [ ] Rewrite every `eslint-plugin-import` usage to `eslint-plugin-import-x`, including the plugin key and each `import/` rule prefix. A `plugin:import/<name>` config a flat config extends becomes `importX.flatConfigs.<name>`.
- [ ] Rename the `import/` keys under `settings` (`import/resolver`, `import/extensions`, `import/parsers`, `import/core-modules`, `import/external-module-folders`, `import/ignore`) to `import-x/`. `eslint-plugin-import-x` reads only its own keys, so a leftover `import/resolver` silently falls back to the default resolver.
- [ ] Delete `eslint-plugin-react` and `eslint-plugin-jsx-a11y` registrations, the `plugin:react/` and `plugin:jsx-a11y/` configs a config extends, and every `react/` and `jsx-a11y/` rule.
- [ ] Once no config imports a removed plugin, list the projects with a lint target: `nx show projects --with-target lint`.
- [ ] Fix the ESLint directive comments that lint reports as `Definition for rule '...' was not found`. A directive for an undefined rule is a lint error in itself, so lint cannot pass while one is left. Rewrite an `import/` prefix to `import-x/`. Remove a `react/` or `jsx-a11y/` rule from an `eslint-disable` or `eslint-enable` list, delete the inline configuration of one (`/* eslint react/no-danger: "error" */`), and delete a comment left with no rule. The pre-pass report lists the files that carry such directives, unless its directive scan did not run. Leave a directive there that lint does not report: another config still registers its plugin. Sections 3 and 6 name the only other source-file edits this migration allows.
- [ ] Before deleting a comment that is alone on its line, check the lines above it. An `eslint-disable-next-line` comment on the line directly above would then apply to the code below. So would a `@ts-ignore` comment with only blank lines or `//` comments between, because TypeScript skips those. Decide whether that comment should apply to the code below before removing the line.
- [ ] Search for the directive comments the pre-pass did not check, and run `npx eslint <file>` on each hit before editing it: change a file only when ESLint reports the error for it, and leave a file it reports as ignored. The directive scan only reads JavaScript and TypeScript files, and only for the prefixes of the plugins the report lists as removed: `import/` for `eslint-plugin-import`, `react/` for `eslint-plugin-react`, `jsx-a11y/` for `eslint-plugin-jsx-a11y`. Search every file for the other prefixes, including the files a lint target covers, and the other file types for all three. When the scan did not run, search every file for all three.
- [ ] Leave configs that get these rules from an Nx preset alone. `@nx/eslint-plugin`'s `flat/react`, `flat/react-base` and `flat/react-jsx` already resolve the right plugin set for the running ESLint major. Their directives are not exempt: on ESLint v10 the presets register the fork under the `import-x` key, so an `import/` directive in source still has to be rewritten.
- [ ] Leave the `react/`, `jsx-a11y/` and `import/` rules alone in a config that spreads `eslint-config-next`, extends `next` or registers `@next/next`, and in the directives of the files that config lints. eslint-config-next registers those three plugins itself, its 16.4 release supports ESLint v10, and the `@nx/next` migration rewrites the older Next.js entries to spread it or lists the configs it could not rewrite. The exemption does not cover a config that uses the `core-web-vitals` config of `@next/eslint-plugin-next` (`nextEslintPluginNext.configs['core-web-vitals']`). That config registers only `@next/next`, and the `@nx/next` migration switches to it when another config may register one of those plugins. Apply the rules above to such a config and the files it lints.
- [ ] Report the dropped `react/` and `jsx-a11y/` rules in your handoff summary so the loss of coverage is visible.

## 3. Replace the `/* eslint-env */` comments

**Search pattern**: the source files the pre-pass report lists, plus `/* eslint-env` in the files the pre-pass does not scan. Without a report, search the whole workspace. Run `npx eslint <file>` on a hit no lint target covers before editing it, as in section 2.

**What changed**: ESLint v9 applied `/* eslint-env */` comments only on eslintrc. On flat config it ignored them and printed a warning that they would become errors in v10, and v10 reports each one as `/* eslint-env */ comments are no longer supported`. One leftover comment fails the lint run for its file, whether or not the workspace was converted here.

The pre-pass forwards every one and changes none, because it cannot tell whether an eslintrc config applied a comment's globals before this run.

Only the block form is a directive. A `// eslint-env node` line comment was never read by ESLint and needs no change.

**Before:**

```js
/* eslint-env node */
module.exports = { port: process.env.PORT };
```

**After:**

```js
// eslint.config.mjs
import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
```

**Action items**:

- [ ] For each reported file, move the globals the comment declared into the `languageOptions.globals` of the flat config that covers it, then delete the comment. The `globals` package exports each environment by name, so `eslint-env node` becomes `...globals.node`.
- [ ] Use a `/* global ... */` comment instead when a single file needs globals the rest of the project does not.
- [ ] Never delete one without replacing what it declared. Where a config applied its globals, they turn into `no-undef` errors.
- [ ] Before deleting a comment that is alone on its line, check the lines above it, as in section 2.

## 4. Check the remaining plugins for ESLint v10 support

**Search pattern**: `dependencies` and `devDependencies` entries matching `eslint-plugin-*`, `@<scope>/eslint-plugin-*`, `eslint-config-*`, and any package registered under `plugins` in a flat config.

**What changed**: a plugin that was never updated for v10 either fails to load or throws at lint time. The usual cause is one of the four rule-context methods v10 removed, each replaced by a property that has been available since v8.40:

| Removed                         | Replacement                |
| ------------------------------- | -------------------------- |
| `context.getCwd()`              | `context.cwd`              |
| `context.getFilename()`         | `context.filename`         |
| `context.getPhysicalFilename()` | `context.physicalFilename` |
| `context.getSourceCode()`       | `context.sourceCode`       |

The pre-pass read the `peerDependencies.eslint` of each root `package.json` dependency that declares one and reported the ones that rule ESLint v10 out, unless the pre-pass report says the check did not run. It did not check plugins declared only in a project's `package.json`. That list is a floor, not a clearance: a package with an open range (`>=8`) or no ESLint peer at all passes the check and can still fail at lint time.

**Action items**:

- [ ] Update or replace each plugin the pre-pass report lists as declaring no ESLint v10 support.
- [ ] Resolve each unmet `eslint` peer the package manager reports on install, including those of packages the workspace does not declare. `vue-eslint-parser`, which `eslint-plugin-vue` takes as a peer, is one: update it to a release whose peer range admits ESLint v10.
- [ ] For the rest, treat a thrown error at lint time as a plugin version problem, not a rule violation. Update the plugin; never disable its rules to silence a crash.
- [ ] If the workspace authors its own ESLint rules, replace each removed `context` call with the property above.

## 5. Confirm the Node.js version

ESLint v10 requires Node.js `^20.19.0 || ^22.13.0 || >=24`.

**Action items**:

- [ ] If `package.json` declares `engines.node`, narrow it so it cannot resolve to a Node.js version ESLint v10 rejects. The pre-pass report gives the result for the root `package.json`.
- [ ] Update the Node.js version used in CI and in any container image that runs lint.

## 6. Remove the eslintrc-only options from lint targets

**Search pattern**: `ignore-path`, `rulesdir`, `resolve-plugins-relative-to` and `no-eslintrc` in the `options` and `configurations` of lint targets in `project.json`, and in the nx.json `targetDefaults` entries filtered to `@nx/eslint/plugin`, both as keys and as flags in their `args`. The pre-pass report names each one the pre-pass left.

**What changed**: these options only exist for eslintrc. When Nx 24 converted `@nx/eslint:lint` targets to inferred tasks, they stayed on the target. The task passes `ignore-path`, `no-eslintrc`, `resolve-plugins-relative-to` and a `rulesdir` given as one path to ESLint as CLI flags, and passes the flags in `args` as written. ESLint v10 rejects each one as an invalid option. A `rulesdir` list is never passed on, so the rules in that directory are not loaded at all.

When it ran the conversion, the pre-pass removed `no-eslintrc` from the inferred lint targets of every project whose config it did not skip. It left every `ignore-path`. It left `no-eslintrc` on `eslint` command and executor targets and on projects whose config it skipped. It removed nothing from `args`: a flag there, such as `--ignore-path=.lintignore`, gets the same treatment as the option in the items below, and the flag is what you delete. A relative path in what is left may be relative to the workspace root, where the removed executor ran ESLint, or to the project root, where the inferred target runs it. Use whichever exists.

**Action items**:

- [ ] `ignore-path`: keep the files each run ignores the same, then delete every `ignore-path`. Do not move the patterns into a flat config's `ignores`: those apply to every run of that config, including the editor and other targets that never used the file. Each run uses one `ignore-path` and one `args`. A configuration's options replace the target's key by key, and a project or a narrower `targetDefaults` entry replaces the options of a shared entry the same way. Both are called overrides below.
  - Pass the file's patterns as `--ignore-pattern` flags in the `args` next to its `ignore-path`. An override with its own `ignore-path` gets only its own patterns. An override that sets `args` but no `ignore-path` inherited the file, so add that file's patterns to its `args`. Every `args` you write keeps the flags its runs already passed, since an override's `args` replaces the inherited one.
  - Rewrite each line of the file for the flag. ESLint resolves both from the directory it runs in, the target's `cwd`, but the file uses gitignore syntax: a pattern with no slash, or only a trailing one, matches at any depth, and any other slash anchors it. So `dist` becomes `**/dist`, and `/dist` becomes `dist`.
  - Quote each pattern inside its `args` entry. Nx passes `args` to the shell unquoted, so an unquoted glob is expanded before ESLint sees it. An array set as an `ignore-pattern` option is dropped, so use `args`.
  - Delete the ignore file once no `ignore-path` names it and nothing else in the workspace references it. Never delete `.gitignore` or a file another tool reads.
- [ ] `rulesdir`: flat config has no rules directory. Register the directory's rules as a local plugin in the flat config, for example `plugins: { local: { rules } }`, rename each reference to those rules, in configs and in directive comments, to `local/<rule>`, then delete the option.
- [ ] `resolve-plugins-relative-to`: flat config loads each plugin from the config module that imports it. If the config loads eslintrc-style configs through `FlatCompat`, pass the directory to it as `resolvePluginsRelativeTo`. Otherwise check that every plugin the config imports resolves from the config file. Then delete the option.
- [ ] `no-eslintrc`: delete the option. Flat config never merges configs from parent directories, so it has no equivalent.
- [ ] Leave `report-unused-disable-directives` as it is: ESLint v10 still accepts it.

## Post-Migration Validation

1. Confirm lint passes in every project with a lint target. How depends on where you run:
   - When your instructions forbid `nx run-many`, or a validation step follows yours in the same `nx migrate` run, do not lint the whole workspace. Run `npx eslint <file>` on a file each edited config covers, or `npx eslint --print-config <file>` to confirm the config loads, and leave the full lint to the validation step.
   - Otherwise, lint every project:

     ```bash
     nx run-many -t lint --skip-nx-cache
     ```

     `--skip-nx-cache` keeps a result cached on ESLint v9 from replaying when the workspace's lint inputs leave out the ESLint version.

2. Fix the failures this migration caused and re-run until green. Do not disable a rule the user configured, and do not edit source files beyond the cases sections 2, 3 and 6 authorize.

   Expect failures from four places, all of them addressed above. Three are not rule violations at all: a directive comment naming a rule that no longer exists (section 2) and an `/* eslint-env */` comment (section 3), each reported against the comment itself, and a lint target option section 6 covers, which fails as an `Invalid option` error or, for a `rulesdir` list, as a rule ESLint cannot find.

   The fourth is a rule-set change, and ESLint v10 is not its source: v10 enforces the same rules as v9, so anything newly enabled comes from a package the pre-pass added or moved. Two can do that, and the pre-pass report says which of them applied. A config that extends `eslint:recommended` and was converted here, or that a converted config loads through `FlatCompat`, picks up `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error` from `@eslint/js` when the workspace had no such dependency before. A config that pulls `eslint-plugin-react-hooks`'s own `recommended` preset picks up the React Compiler rules, which v7 added to that preset with 12 of them at error severity. A config that reaches react-hooks through `@nx/eslint-plugin`'s `flat/react` or `flat/react-jsx` does not: those pin `rules-of-hooks` and `exhaustive-deps` on ESLint v10. Both came from a changed preset default, not from the user, so turn the rules off in the flat config with a short comment rather than editing source, and never weaken `rules-of-hooks` or `exhaustive-deps`.

3. Spot-check that a converted project resolves its config:

   ```bash
   npx eslint --print-config <a-file-in-the-project>
   ```

4. Confirm no `.eslintrc.*` files remain, except ones a flat config loads through `FlatCompat`.

<fail_if note="if you cannot reach a passing state within the scope above, stop and report">
Lint cannot pass without editing source files beyond stale or renamed rule directives and `/* eslint-env */` comments, or without disabling a rule the user configured. Write status: failed and name the rule and project in your summary. Do not guess.
</fail_if>

## Nx-Specific Notes

- **Shared base config pattern**: many Nx workspaces have a root `eslint.config.mjs` that each project imports, for example `import baseConfig from '../../eslint.config.mjs'`. Convert and verify the base config first, then the per-project configs.
- **Inferred plugin targets**: `@nx/eslint/plugin` infers each project's lint target from the ESLint config that covers it, and caches the result. The cache key covers the project's files and the lockfile but not a config outside the project. So after you convert, rename or edit the root or base config, a project without its own config can keep a stale target. Check one such project with `NX_DAEMON=false NX_CACHE_PROJECT_GRAPH=false nx show project <name>`, which recomputes its targets without the cache.

## References

- Migrate to ESLint v10.0.0: https://eslint.org/docs/latest/use/migrate-to-10.0.0
- ESLint configuration files: https://eslint.org/docs/latest/use/configure/configuration-files
- eslint-plugin-import-x: https://github.com/un-ts/eslint-plugin-import-x
- Nx ESLint plugin: https://nx.dev/nx-api/eslint
