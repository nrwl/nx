# Empty workspace

A genuinely empty Nx workspace for exercising setup paths — `init` generators,
inference plugins, `nx add` flows — against the packages in your working tree
rather than a published release.

There are no projects, no `tsconfig.json` and no source files, so whatever a
generator does to the workspace is the entire diff.

It is a standalone pnpm workspace with its own lockfile, so installing here
never touches the repo root. Local packages are wired in with `link:`
dependencies, which work across workspace boundaries.

## Setup

```shell
pnpm install
```

The `postinstall` builds the linked packages from source, so the workspace runs
your working-tree code.

## Testing a package

Link whatever you are exercising and add it to the `postinstall` build list:

```jsonc
// package.json
"devDependencies": {
  "@nx/vite": "link:../../packages/vite"
}
```

Generators normally reached through `nx add` resolve from the registry, so for
an unpublished or locally modified package call the generator directly:

```shell
nx g @nx/oxlint:init
```

Then inspect what it produced:

```shell
git status
nx show projects
```

Generate a project into the workspace when you need something for an inference
plugin to pick up — most of them deliberately skip projects with no matching
files:

```shell
nx g @nx/js:lib packages/demo --linter oxlint
```

`.vscode/extensions.json` mirrors what `create-nx-workspace` generates, so
generators that append editor recommendations have something to append to. They
skip workspaces without the file rather than creating one.

## Do not give the root a project

The root `package.json` deliberately has no `nx` key. Adding one turns the root
into a project (`root: '.'`), and `findProjectForPath` then matches _any_ path —
including paths outside the workspace. Local `link:` dependencies get treated as
workspace source, so Nx loads a plugin's TypeScript source instead of its built
`dist`, and generators fail on NodeNext `.js` import specifiers that only exist
after a build.

## Resetting between runs

```shell
git clean -fdx . && git checkout -- .
pnpm install
```
