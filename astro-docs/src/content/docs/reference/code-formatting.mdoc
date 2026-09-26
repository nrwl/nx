---
title: Code Formatting Reference
description: Learn how Nx detects which code formatter your workspace uses, how oxfmt and Prettier differ, and how to switch between them.
sidebar:
  order: 6
  label: Code formatting
filter: 'type:References'
---

Nx formats code when you run `nx format:write` or `nx format:check` and at the end of most generators and migrations.
All of them use the same formatter, which Nx detects from your workspace.

Two formatters are supported: [oxfmt](https://oxc.rs) and [Prettier](https://prettier.io).
Prettier is the default wherever workspace creation asks which one to use, and oxfmt is offered as
experimental while it is pre-1.0.

## How Nx picks a formatter

Detection runs in this order, and the first match wins:

1. An oxfmt config file exists at the workspace root.
2. A Prettier config file exists at the workspace root, or `package.json` has a `prettier` key.
3. `package.json` declares an `oxfmt` dependency.
4. `package.json` declares a `prettier` dependency.

Steps 3 and 4 read the root `package.json` only.
A formatter that reaches `node_modules` as a transitive dependency doesn't count.

If nothing matches, `nx format:write` and `nx format:check` warn and exit `0`, and generators skip
formatting.

The oxfmt config files Nx looks for:

- `.oxfmtrc.json`
- `.oxfmtrc.jsonc`
- `oxfmt.config.ts`
- `oxfmt.config.mts`

### When both are configured

oxfmt wins, and Nx warns once so the switch is not silent.
Adding an `.oxfmtrc.json` to a workspace that already has a `.prettierrc` switches the whole
workspace over, including generator formatting.
To go back, delete the oxfmt config.

## Switch an existing workspace to oxfmt

```shell
npm add -D oxfmt
```

```json {% title=".oxfmtrc.json" %}
{
  "singleQuote": true,
  "printWidth": 80
}
```

These match an Nx-generated `.prettierrc`.
If you wrote your own, match what it set instead.
oxfmt defaults to double quotes and a width of 100.

oxfmt also sorts `package.json` keys, which Prettier does not.
Expect every manifest in the workspace to be reordered on the first run.
Set `"sortPackageJson": false` in `.oxfmtrc.json` to keep your current order.

Then delete `.prettierrc` and run `nx format:write --all` to reformat everything in one commit.

Keep `.prettierignore` if you have one.
oxfmt reads it too, so deleting it starts formatting files you had excluded.

## Generator formatting and `nx format` differ

`nx format:write` runs the formatter's own CLI.
Generators format files that exist only in memory, so Nx applies the configuration itself.
With oxfmt, both resolve from each file's own directory upwards: the nearest oxfmt config, its
`overrides` and `ignorePatterns`, and every `.gitignore` and `.prettierignore` along the way.
With Prettier, both read the root ignore files only, so a nested `.prettierignore` has no effect
either way.

A nested oxfmt config replaces the one above it rather than merging with it, so any option it leaves
out falls back to the oxfmt default and not to the parent's value.

`.editorconfig` is the exception.
oxfmt looks it up once from the directory it runs in rather than from each file upwards.
For `nx format` that directory is the one you run the command from; generators anchor the lookup at
the workspace root, so a nested `.editorconfig` never affects generated files.
The lookup walks up until a file sets `root = true`, so a checkout containing your workspace can
contribute settings.

A root `.editorconfig` that sets `indent_size` without `indent_style` also leaves the two
disagreeing.
Generator formatting applies it and `nx format:write` ignores it, so your generated files fail your
own `nx format:check`.
Set `indent_style` alongside it.

## Skip formatting

Set [`NX_SKIP_FORMAT=true`](/docs/reference/environment-variables) to stop generators and migrations
from formatting.
It also covers the files `nx init` and `nx import` write, and the formatting pass at the end of
`create-nx-workspace`.
TypeScript path sorting is separate and stays off by default.
Turn it on with `NX_FORMAT_SORT_TSCONFIG_PATHS=true`, or per call with `formatFiles`'
`sortRootTsconfigPaths` option.

```shell
NX_SKIP_FORMAT=true nx g @nx/react:app my-app
```

## Choose a formatter at workspace creation

`create-nx-workspace` asks which formatter you want on every preset that sets one up: a stack
(React, Vue, Angular, or Node), `web-components`, the TypeScript monorepo, and `ts-standalone`.
Whether the workspace uses package manager workspaces makes no difference.
The `apps` and `npm` presets generate no project, so they set up no formatter unless you pass
`--formatter`, and neither does `@nx/workspace:new` run directly.
Pass `--formatter` on any path to choose explicitly:

```shell
npx create-nx-workspace@latest my-workspace --formatter=prettier
```

The accepted values are `oxfmt`, `prettier`, and `none`.
