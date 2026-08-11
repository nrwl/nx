# ESLint v10 Migration Instructions for LLM

## Overview

These instructions guide you through finishing the migration of an Nx workspace to ESLint v10.

ESLint v10 removed the eslintrc configuration format outright. Unlike v9, where `.eslintrc.*` still worked behind `ESLINT_USE_FLAT_CONFIG=false`, v10 has no eslintrc support and no escape hatch: an eslintrc file is simply not read. v10 also raised the Node.js floor to `^20.19.0 || ^22.13.0 || >=24`, and `eslint-plugin-import`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react` have no v10 release.

The migration runs in two halves:

1. A deterministic pre-pass that converted the eslintrc configs it could read and replaced the plugins that cannot run on v10.
2. This prompt: finish what the pre-pass could not do safely, and leave the workspace lint-passing.

Out of scope: changing what rules the workspace enforces beyond what the removed plugins force, and upgrading any package other than the ESLint plugins named here. Source files are edited only for the two cases named in sections 2 and 3: directive comments naming a rule that no longer exists, and `/* eslint-env */` comments.

<pre_pass_summary note="a deterministic pre-pass already applied these edits; verify the new shape is in place rather than redoing them">

The pre-pass changed, mechanically:

- Converted the remaining eslintrc configs to flat config through the `@nx/eslint:convert-to-flat-config` generator. JavaScript-based configs (`.eslintrc.js`, `.eslintrc.cjs`) are read statically, so the ones built from literal values were converted too.
- Removed `eslint-plugin-import`, `eslint-plugin-jsx-a11y` and `eslint-plugin-react` from `package.json`, installed `eslint-plugin-import-x` in place of `eslint-plugin-import`, and updated `eslint-plugin-react-hooks` to v7, whose `recommended` preset also enables the React Compiler rules.

The pre-pass also detected and reported, without changing anything:

- eslintrc files still in the workspace, and whether they were being applied until this run or had already been shadowed by a flat config at the root.
- Files that reference a removed plugin: configs, and modules a config builds on that import one by package name.
- Source files whose ESLint directive comments name a rule from a removed plugin.
- Source files carrying `/* eslint-env */` comments, which ESLint v10 reports as errors.
- Installed dependencies whose `peerDependencies.eslint` rules out the ESLint the workspace now runs.
- A newly added `@eslint/js`, whose recommended set is wider than the one the eslintrc config applied.

The pre-pass does NOT:

- Convert an eslintrc config whose values are computed at runtime (a `require` call, a template with substitutions, `__dirname`, a conditional). It never executes the file, so it reports those instead of guessing.
- Rewrite anything that references the removed plugins, in a config or in a source file's directive comments, or replace an `/* eslint-env */` comment. Deciding where a comment's globals belong is a judgment call, so it reports them instead.
- Clear a plugin for ESLint v10. Its peer scan only catches the packages whose declared range rules v10 out; an open range such as `>=8` admits v10 whether or not the package works on it.
- Verify that lint still passes.

Everything the pre-pass could not finish is forwarded to you in `<advisory_context>`.

How to read the wrapper sections above this file:

- `<files_changed>` lists files the pre-pass wrote. Verify the new shape is in place; do not re-apply the same edit. It is absent when the pre-pass made no changes.
- `<advisory_context>` lists detections the pre-pass forwarded because it could not safely complete them. Every entry is pending work. Address each one in the relevant section below.

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
   - Flat configs: `eslint.config.{mjs,cjs,js}` and `eslint.base.config.*` at the root and in each project.
   - Any remaining eslintrc files: `.eslintrc`, `.eslintrc.json`, `.eslintrc.yaml`, `.eslintrc.yml`, `.eslintrc.js`, `.eslintrc.cjs`.

3. **Identify all lint targets**:

   ```bash
   nx show projects --with-target lint
   ```

## 1. Convert the eslintrc configs the pre-pass could not read

**Search pattern**: the `.eslintrc.*` files forwarded in `<advisory_context>`.

**What changed**: ESLint v10 does not read eslintrc files. A file left behind is not an error, it is silently ignored, so the rules it holds stop being enforced.

Some leftovers were already dormant before this migration: a flat config at the workspace root wins over every eslintrc below it, so ESLint had stopped reading those files well before v10. `<advisory_context>` says which case each one is. Folding a dormant file in turns rules back on that the workspace has not been running, so expect new errors there and keep them separate in your summary from the enforcement this migration actually dropped.

Convert each one to a flat config next to it, mirroring the shape of the configs the pre-pass produced.

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

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
];
```

**Action items**:

- [ ] Convert each reported config to `eslint.config.mjs`, preserving its rules, plugins, parser options and overrides.
- [ ] Translate eslintrc keys to their flat-config equivalents: `env` to `languageOptions.globals`, `parser` / `parserOptions` to `languageOptions`, `ignorePatterns` to `ignores`, `overrides` entries to separate config objects with a `files` key.
- [ ] Widen the eslintrc glob semantics: `*.ts` in eslintrc matches at any depth, so it becomes `**/*.ts` in flat config.
- [ ] Delete the original eslintrc file once the flat config replaces it.
- [ ] Update any `nx.json` or `project.json` input that referenced the old file name.

## 2. Rewrite references to the removed plugins

**Search pattern**: the config files forwarded in `<advisory_context>`, plus `eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, and the `import/`, `react/`, `jsx-a11y/` rule prefixes across all ESLint configs.

**What changed**: those three plugins have no ESLint v10 release, so the pre-pass removed them from `package.json`. A config that still imports one, registers it under `plugins`, or configures its rules now fails to load with `Could not find plugin` or a module resolution error.

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

`eslint-plugin-react` and `eslint-plugin-jsx-a11y` have no v10 substitute. Delete their plugin registrations and the rules that use their prefixes; do not look for a replacement package.

**Action items**:

- [ ] Rewrite every `eslint-plugin-import` usage to `eslint-plugin-import-x`, including the plugin key and each `import/` rule prefix.
- [ ] Delete `eslint-plugin-react` and `eslint-plugin-jsx-a11y` registrations and every `react/` and `jsx-a11y/` rule.
- [ ] Fix the ESLint directive comments in source files that name a rule the workspace can no longer resolve: rewrite an `import/` prefix to `import-x/`, and delete the ones naming a `react/` or `jsx-a11y/` rule, including the inline `/* eslint react/no-danger: "error" */` form. A directive for an undefined rule is a lint error in itself (`Definition for rule '...' was not found`), so lint cannot pass while one is left. This is the one source-file edit this migration allows.
- [ ] Leave configs that get these rules from an Nx preset alone. `@nx/eslint-plugin`'s `flat/react`, `flat/react-base` and `flat/react-jsx` already resolve the right plugin set for the running ESLint major. Their directives are not exempt: on ESLint v10 the presets register the fork under the `import-x` key, so an `import/` directive in source still has to be rewritten.
- [ ] Report the dropped `react/` and `jsx-a11y/` rules in your handoff summary so the loss of coverage is visible.

## 3. Replace the `/* eslint-env */` comments

**Search pattern**: the source files forwarded in `<advisory_context>`, plus `/* eslint-env` across the workspace.

**What changed**: flat config never read `/* eslint-env */` comments. ESLint v9 tolerated them, printing a process warning that they would become errors in v10; v10 makes good on it and reports each one as `/* eslint-env */ comments are no longer supported`. One leftover comment fails the lint run for its file, whether or not the workspace was converted here.

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

- [ ] For each reported file, move the globals its comment declared into the `languageOptions.globals` of the flat config that covers it, then delete the comment. The `globals` package exports each environment by name, so `eslint-env node` becomes `...globals.node`.
- [ ] Use a `/* global ... */` comment instead when a single file needs globals the rest of the project does not.
- [ ] Never delete the comment without replacing what it declared. The globals it provided turn into `no-undef` errors.

## 4. Check the remaining plugins for ESLint v10 support

**Search pattern**: `dependencies` and `devDependencies` entries matching `eslint-plugin-*`, `@<scope>/eslint-plugin-*`, `eslint-config-*`, and any package registered under `plugins` in a flat config.

**What changed**: a plugin that was never updated for v10 either fails to load or throws at lint time. The usual cause is one of the four rule-context methods v10 removed, each replaced by a property that has been available since v8.40:

| Removed                         | Replacement                |
| ------------------------------- | -------------------------- |
| `context.getCwd()`              | `context.cwd`              |
| `context.getFilename()`         | `context.filename`         |
| `context.getPhysicalFilename()` | `context.physicalFilename` |
| `context.getSourceCode()`       | `context.sourceCode`       |

The pre-pass read the `peerDependencies.eslint` of every installed dependency that declares one and forwarded the ones that rule ESLint v10 out, unless `<advisory_context>` says the check did not run. That list is a floor, not a clearance: a package with an open range (`>=8`) or no ESLint peer at all passes the check and can still fail at lint time.

**Action items**:

- [ ] Update or replace each plugin forwarded in `<advisory_context>` as declaring no ESLint v10 support.
- [ ] For the rest, treat a thrown error at lint time as a plugin version problem, not a rule violation. Update the plugin; never disable its rules to silence a crash.
- [ ] If the workspace authors its own ESLint rules, replace each removed `context` call with the property above.

## 5. Confirm the Node.js version

ESLint v10 requires Node.js `^20.19.0 || ^22.13.0 || >=24`.

**Action items**:

- [ ] If `package.json` declares `engines.node`, narrow it so it cannot resolve to a Node.js version ESLint v10 rejects.
- [ ] Update the Node.js version used in CI and in any container image that runs lint.

## Post-Migration Validation

1. Clear the inference cache so renamed configs are re-detected:

   ```bash
   nx reset
   ```

2. Confirm lint passes across the workspace:

   ```bash
   nx run-many -t lint
   ```

3. Fix the failures this migration caused and re-run until green. Do not disable a rule the user configured, and do not edit source files beyond the two cases sections 2 and 3 authorize.

   Expect failures from three places, all of them addressed above. Two are not rule violations at all: a directive comment naming a rule that no longer exists (section 2) and an `/* eslint-env */` comment (section 3), each reported against the comment itself.

   The third is a rule-set change, and ESLint v10 is not its source: v10 enforces the same rules as v9, so anything newly enabled comes from a package the pre-pass moved. Two can do that, and `<advisory_context>` says which of them applied. A config that extends `eslint:recommended` and was converted here picks up `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error` from `@eslint/js` when the workspace had no such dependency before. A config that pulls `eslint-plugin-react-hooks`'s own `recommended` preset picks up the React Compiler rules, which v7 added to that preset with 12 of them at error severity. Both came from a changed preset default, not from the user, so turn the rules off in the flat config with a short comment rather than editing source, and never weaken `rules-of-hooks` or `exhaustive-deps`.

4. Spot-check that a converted project resolves its config:

   ```bash
   npx eslint --print-config <a-file-in-the-project>
   ```

5. Confirm no `.eslintrc.*` files remain.

<fail_if note="if you cannot reach a passing state within the scope above, stop and report">
Lint cannot pass without editing source files beyond stale rule directives and `/* eslint-env */` comments, or without disabling a rule the user configured. Write status: failed and name the rule and project in your summary. Do not guess.
</fail_if>

## Nx-Specific Notes

- **Shared base config pattern**: many Nx workspaces have a root `eslint.config.mjs` that each project imports, for example `import baseConfig from '../../eslint.config.mjs'`. Convert and verify the base config first, then the per-project configs.
- **Inferred plugin targets**: `@nx/eslint/plugin` infers the lint target from the presence of `eslint.config.*`. Renaming or moving a config invalidates inference. After config edits, run `nx reset && nx show project <name>` on a sample project to confirm the target is still there.
- **Executor options with no flat-config equivalent**: `@nx/eslint:lint` rejects `ignorePath`, `resolvePluginsRelativeTo` and `reportUnusedDisableDirectives` when the project uses flat config. Fold `ignorePath` patterns into `ignores` and `reportUnusedDisableDirectives` into `linterOptions`; `resolvePluginsRelativeTo` has no equivalent.

## References

- Migrate to ESLint v10.0.0: https://eslint.org/docs/latest/use/migrate-to-10.0.0
- ESLint configuration files: https://eslint.org/docs/latest/use/configure/configuration-files
- eslint-plugin-import-x: https://github.com/un-ts/eslint-plugin-import-x
- Nx ESLint plugin: https://nx.dev/nx-api/eslint
