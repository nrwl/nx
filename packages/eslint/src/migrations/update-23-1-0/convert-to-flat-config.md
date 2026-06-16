# ESLint v9 Flat Config Migration Instructions for LLM

## Overview

These instructions guide you through finishing the migration of an Nx workspace to ESLint v9.

ESLint v9 makes flat config (`eslint.config.{mjs,cjs,js}`) the default config format. The legacy eslintrc format (`.eslintrc.*`) still works at runtime, but only when `ESLINT_USE_FLAT_CONFIG=false` is set, so Nx converts workspaces to flat config instead of relying on that escape hatch.

The migration runs in two halves:

1. A deterministic pre-pass (the `@nx/eslint:convert-to-flat-config` generator) that already converted the JSON and YAML eslintrc configs and bumped the ESLint stack.
2. This prompt: finish the parts that need judgment and leave the workspace lint-passing.

Work systematically through each section below.

<pre_pass_summary note="a deterministic pre-pass already applied these edits; verify the new shape is in place rather than redoing them">

The pre-pass handled, mechanically:

- Bumped `eslint` to `^9.8.0`, the `typescript-eslint` packages to `^8.40.0`, and `eslint-config-prettier` to `^10.0.0` (via `packageJsonUpdates`, only for packages already present).
- Converted the root and per-project JSON/YAML eslintrc files to `eslint.config.mjs`:
  - `eslint:recommended` to `js.configs.recommended`
  - `@nx/*` presets to their flat-config equivalents
  - `env` to `languageOptions.globals`
  - `parser` / `parserOptions` to `languageOptions`
  - `plugins` to the flat `plugins` object
  - `ignorePatterns` and `.eslintignore` to `ignores`
  - stale `.eslintrc`/`.eslintignore` references in `nx.json` and `project.json` inputs
- Added `@eslint/js` and `@eslint/eslintrc` to `package.json` when the converted config needs them.

The pre-pass does NOT:

- Convert JavaScript-based eslintrc files (`.eslintrc.js`, `.eslintrc.cjs`). It cannot evaluate them safely.
- Change the output formatter a lint target uses.
- Decide whether a generated `FlatCompat` shim should become flat-native config.
- Make the workspace pass lint after ESLint v9 changed which rules its preset defaults enable.

Everything the pre-pass could not finish is forwarded to you in `<advisory_context>`.

How to read the wrapper sections above this file:

- `<files_changed>` lists files the pre-pass wrote. Verify the new shape is in place; do not re-apply the same edit. It is absent when the pre-pass made no changes (for example a workspace that was already on flat config).
- `<advisory_context>` lists detections the pre-pass forwarded because it could not safely complete them. Every entry is pending work. Address each one in the relevant section below.

</pre_pass_summary>

<handoff_guidance>
In your handoff `summary` (1 to 3 sentences per the system prompt), name the sections you applied and explicitly call out any you skipped because they did not apply (for example "no JavaScript-based configs and no removed formatters in this workspace").
</handoff_guidance>

## Pre-Migration Checklist

1. **Confirm the ESLint version is v9**:

   ```bash
   npx eslint --version
   ```

2. **Locate all ESLint config files**:
   - Flat configs: `eslint.config.{mjs,cjs,js}` at the root and in each project.
   - Any remaining eslintrc files: `.eslintrc`, `.eslintrc.json`, `.eslintrc.yaml`, `.eslintrc.yml`, `.eslintrc.js`, `.eslintrc.cjs`.
   - Ignore files: `.eslintignore`.

3. **Identify all lint targets**:

   ```bash
   nx show projects --with-target lint
   ```

   Check `project.json` files for the `@nx/eslint:lint` executor or `eslint` run-commands. Workspaces using the inferred plugin (`@nx/eslint/plugin`) get lint targets from the presence of `eslint.config.*`; inspect them with `nx show project <name> --json`.

4. **Identify local ESLint rules or plugins** authored inside the workspace. These use the rule API that changed in v9 (see section 6).

---

## Nx-Specific Notes (read first)

- **Flat config is the default in v9**. eslintrc only resolves when `ESLINT_USE_FLAT_CONFIG=false` is set. Nx converts the workspace to flat config so that no environment variable is required.
- **Shared base config pattern**: many Nx workspaces have a root `eslint.config.mjs` that each project imports, for example `import baseConfig from '../../eslint.config.mjs'`. Convert and verify the base config first, then the per-project configs.
- **Inferred plugin targets**: `@nx/eslint/plugin` infers the lint target from the presence of `eslint.config.*`. Renaming or moving the config invalidates inference. After config edits, run `nx reset && nx show project <name>` on a sample project to confirm the target is still present.
- **FlatCompat shim**: when the pre-pass could not translate a third-party `extends` or a complex override natively, it emitted a `FlatCompat` shim (from the `@eslint/eslintrc` package). That config works as-is, but section 3 covers replacing it with flat-native config where low-risk.

---

## 1. Already on flat config? Verify only

If the workspace already uses `eslint.config.*` at the root and in every project, with no remaining `.eslintrc.*` files, do NOT restructure it. The only required work is the passing-state check in section 4: a workspace that was just bumped from ESLint v8 to v9 can newly fail because v9 changed which rules its preset defaults enable, even when the config was already flat.

## 2. Convert JavaScript-based ESLint configs the pre-pass skipped

**Search pattern**: `.eslintrc.js` and `.eslintrc.cjs` files (forwarded in `<advisory_context>`).

**What changed**: the pre-pass only converts JSON and YAML eslintrc files. JavaScript-based configs run arbitrary code, so they need manual conversion.

```js
// BEFORE (.eslintrc.js)
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

```js
// AFTER (eslint.config.mjs)
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
];
```

**Action items**:

- [ ] Convert each JavaScript-based config to `eslint.config.mjs`, mirroring the structure the pre-pass produced for the JSON/YAML configs.
- [ ] Preserve the existing rules, plugins, parser options, and overrides.
- [ ] Delete the original `.eslintrc.js` / `.eslintrc.cjs` once the flat config replaces it.
- [ ] Update any `project.json` / `nx.json` inputs that referenced the old file name.

## 3. Convert FlatCompat shims to flat-native config where low-risk

**Search pattern**: `FlatCompat`, `@eslint/eslintrc`, `compat.extends(`, `compat.config(` in the generated `eslint.config.*` files (listed in `<files_changed>`).

**What changed**: `FlatCompat` is a runtime shim that adapts eslintrc-style `extends` into flat config. Many plugins now ship native flat presets, which are clearer and avoid the shim.

**Decision rule**: convert a `FlatCompat` usage to flat-native config when it is low-risk, otherwise keep the shim.

- Low-risk (prefer flat-native): typescript-eslint configs, and plugins that document a flat preset (for example `eslint-plugin-react`, `eslint-plugin-import`).
- Keep the shim: third-party shared configs that do not document a flat-config entry point.

```js
// BEFORE (FlatCompat shim, eslint.config.mjs)
import js from '@eslint/js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [...compat.extends('plugin:@typescript-eslint/recommended')];
```

```js
// AFTER (flat-native, eslint.config.mjs)
import tseslint from 'typescript-eslint';

export default [...tseslint.configs.recommended];
```

**Action items**:

- [ ] For each `FlatCompat` usage, decide flat-native vs keep-the-shim using the rule above.
- [ ] When converting, drop the now-unused `@eslint/eslintrc` import if no shim remains in that file.
- [ ] Re-run lint after each change to confirm the rule set did not silently shift.

## 4. Restore the passing baseline (required)

This is the core requirement of the migration: the workspace must lint cleanly when you are done.

ESLint v9 and typescript-eslint v8 changed which rules their recommended sets enable. A rule the user never configured may now report errors. Disable those rules; do not edit source files to satisfy them.

The set of rules the user explicitly configured before the migration is in `<advisory_context>` (the entry that starts with "Passing-state requirement").

**Procedure**:

1. Run lint across the workspace:

   ```bash
   nx run-many -t lint
   ```

2. For each rule that now reports errors:
   - If the rule ID is NOT in the user's explicit list, it came from a changed preset default. Disable it in the relevant flat config with a short comment explaining why.
   - If the rule ID IS in the user's explicit list, the user chose it. Leave it as-is and report it in your handoff summary.

```js
// Disable a rule that a changed preset default newly enabled (eslint.config.mjs).
export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Newly enabled by the ESLint v9 recommended set; was not enforced before the upgrade.
      'no-unused-expressions': 'off',
    },
  },
];
```

**Action items**:

- [ ] Run lint and collect every newly reported rule.
- [ ] Disable preset-originated rules that the user did not configure.
- [ ] Never disable or weaken a rule the user explicitly configured.
- [ ] Never edit source files to satisfy a newly enabled rule.

<fail_if note="if you cannot reach a passing state without editing source or disabling a user-configured rule, stop and report">
You cannot make lint pass without either editing source files or disabling a rule the user explicitly configured. Write status: failed and explain which rule and project in your summary. Do not guess.
</fail_if>

## 5. Fix removed output formatters

**Search pattern**: the `format` option on lint targets (forwarded in `<advisory_context>`).

**What changed**: ESLint v9 removed several built-in output formatters. The built-ins that remain are `stylish`, `html`, `json`, and `json-with-metadata`. Removed: `compact`, `codeframe`, `unix`, `visualstudio`, `table`, `checkstyle`, `jslint-xml`, `junit`, `tap`.

**Fix**: switch the target to a built-in that remains, or install the matching community package and reference it by its package name.

```bash
# Example: keep junit output by installing the community formatter package.
npm install --save-dev eslint-formatter-junit
```

```jsonc
// project.json (reference the community formatter by package name)
"lint": {
  "executor": "@nx/eslint:lint",
  "options": { "format": "eslint-formatter-junit" }
}
```

**Action items**:

- [ ] For each flagged target, switch to a remaining built-in formatter or a community package.
- [ ] When using a community package, add it to `devDependencies`.

## 6. Other ESLint v9 runtime breaking changes

**Search pattern**: lint executor options, run-commands invoking `eslint`, and local rule/plugin source.

- **Removed CLI flags and executor options**: `--rulesdir`, `--ext`, and `--resolve-plugins-relative-to` were removed. The matching `@nx/eslint:lint` options (`rulesdir`, `resolvePluginsRelativeTo`, `ignorePath`) are not supported for flat config. Move file targeting into the config via the `files` and `ignores` keys.
- **No eslintrc auto-merge**: flat config does not merge `.eslintrc.*` files found up the tree. Every setting must live in `eslint.config.*`.
- **Local rule API moved to `SourceCode`** (only relevant if the workspace authors its own rules):
  - `context.getScope()` to `sourceCode.getScope(node)`
  - `context.getAncestors()` to `sourceCode.getAncestors(node)`
  - `context.getDeclaredVariables()` to `sourceCode.getDeclaredVariables(node)`
  - `context.markVariableAsUsed(name)` to `sourceCode.markVariableAsUsed(name, node)`
  - `context.getSource()` to `sourceCode.getText()`
  - `context.parserServices` to `sourceCode.parserServices`
- **Stricter rule schema**: a custom rule that accepts options must declare `meta.schema` in v9.

**Action items**:

- [ ] Remove unsupported CLI flags and executor options; move targeting into `files` / `ignores`.
- [ ] Update local rules to the `SourceCode` API and add `meta.schema` where required.

---

## Post-Migration Verification

1. Clear the inference cache so renamed configs are re-detected:

   ```bash
   nx reset
   ```

2. Confirm lint passes across the workspace:

   ```bash
   nx run-many -t lint
   ```

3. Spot-check that a converted project resolves its config:

   ```bash
   npx eslint --print-config <a-file-in-the-project>
   ```

4. Confirm no `.eslintrc.*` files remain unless one was intentionally kept.

## References

- ESLint configuration files (flat config): https://eslint.org/docs/latest/use/configure/configuration-files
- Migrate to ESLint v9.0.0: https://eslint.org/docs/latest/use/migrate-to-9.0.0
- typescript-eslint configs: https://typescript-eslint.io/users/configs
- Nx ESLint plugin: https://nx.dev/nx-api/eslint
