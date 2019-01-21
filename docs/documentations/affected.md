# Rebuilding and Retesting What is Affected

As with a regular CLI project, you can build and test apps and libs.

```console
ng g app myapp
ng g app myapp2 --directory=mydirectory
ng g lib mylib
ng g lib mylib2 --directory=mydirectory

ng build myapp
ng build mydirectory-myapp2
ng build mylib # work if the lib is marked as publishable
ng build mydirectory-mylib2 # work if the lib is marked as publishable

ng test myapp # runs unit tests for myapp
ng test mylib # runs unit tests for mylib
ng e2e myapp-e2e # runs e2e tests for myapp
```

Now imagine, `myapp` depends on `mylib`. If we make a change to `mylib`,
we need to make sure nothing in the workspace is affected.
Typically, you would do it like this:

```console
ng build mylib
ng test mylib
ng build myapp
ng test myapp
```

In many organizations, you would have dozens or hundreds of apps and libs.
To be productive in a monorepo, you need to be able to check that your
change is safe, and rebuilding and retesting everything on every change
won't scale, tracing the dependencies manually (as shown above) wont's
scale either. Nx uses code analysis to determine what needs to be rebuild
and retested, and it provides the following three commands you can use:
`affected:build`, `affected:test`, and `affected:e2e`.

- Rerunning build for all the projects affected by a PR

```console
yarn affected:build --base=master --head=HEAD
```

- Rerunning unit tests for all the projects affected by a PR

```console
yarn affected:test --base=master --head=HEAD
```

- Rerunning e2e tests for all the projects affected by a PR

```console
yarn affected:e2e --base=master --head=HEAD
```

When executing these commands, Nx will topologically sort the projects,
and will run what it can in parallel. But we can also explicitly pass
`--parallel` like so:

```console
yarn affected:build --base=master --parallel
yarn affected:test --base=master --parallel
yarn affected:e2e --base=master --parallel
```

We can also pass `--maxParallel` to specify the number of parallel processes.

## affected:build

Run `npm run affected:build -- --help` or `yarn affected:build --help` to see
the available options:

```console
Build applications affected by changes

Run command using --base=[SHA1] (affected by the committed, uncommitted and
untracked changes):
  --base  Base of the current branch (usually master)                   [string]

or using --base=[SHA1] --head=[SHA2] (affected by the committed changes):
  --base  Base of the current branch (usually master)                   [string]
  --head  Latest commit of the current branch (usually HEAD)            [string]

or using:
  --files        A list of files delimited by commas                     [array]
  --uncommitted  Uncommitted changes
  --untracked    Untracked changes

Options:
  --help         Show help                                             [boolean]
  --version      Show version number                                   [boolean]
  --parallel     Parallelize the command              [boolean] [default: false]
  --maxParallel  Max number of parallel processes          [number] [default: 3]
  --all          All projects
  --exclude      Exclude certain projects from being processed
                                                           [array] [default: []]
  --only-failed  Isolate projects which previously failed
                                                      [boolean] [default: false]
```

- `npm run affected:build -- --base=[SHA1] --base=[SHA2]` or `yarn affected:build --base=[SHA1] --base=[SHA2]`. Nx will calculate what changed between the two SHAs, and will build the apps affected by the change. For instance, `yarn affected:build --base=origin/master --base=HEAD` will rebuild what is affected by a PR.
- `npm run affected:build -- --files=libs/mylib/src/index.ts,libs/mylib2/src/index.ts` or `yarn affected:build --files=libs/mylib/src/index.ts,libs/mylib2/src/index.ts`. Nx will build what is affected by changing the two index files.
- `npm run affected:build -- --uncommitted` or `yarn affected:build --uncommitted`. Nx will build what is affected by the uncommitted files (this is useful during development).
- `npm run affected:build -- --untracked` or `yarn affected:build --untracked`. Nx will build what is affected by the untracked files (this is useful during development).

All other options will be passed into the underlying build command (e.g., `yarn affected:build --base=origin/master --base=HEAD --prod`).

## affected:test

Run `npm run affected:test -- --help` or `yarn affected:test --help` to see the available options:

```console
Test applications affected by the change

Run command using --base=[SHA1] (affected by the committed, uncommitted and
untracked changes):
  --base  Base of the current branch (usually master)                   [string]

or using --base=[SHA1] --head=[SHA2] (affected by the committed changes):
  --base  Base of the current branch (usually master)                   [string]
  --head  Latest commit of the current branch (usually HEAD)            [string]

or using:
  --files        A list of files delimited by commas                     [array]
  --uncommitted  Uncommitted changes
  --untracked    Untracked changes

Options:
  --help         Show help                                             [boolean]
  --version      Show version number                                   [boolean]
  --parallel     Parallelize the command              [boolean] [default: false]
  --maxParallel  Max number of parallel processes          [number] [default: 3]
  --all          All projects
  --exclude      Exclude certain projects from being processed
                                                           [array] [default: []]
  --only-failed  Isolate projects which previously failed
                                                      [boolean] [default: false]
```

- `npm run affected:test -- --base=[SHA1] --base=[SHA2]` or `yarn affected:test --base=[SHA1] --base=[SHA2]`. Nx will calculate what changed between the two SHAs, and will test the projects affected by the change. For instance, `yarn affected:test --base=origin/master --base=HEAD` will retest what is affected by a PR.
- `npm run affected:test -- --files=libs/mylib/src/index.ts,libs/mylib2/src/index.ts` or `yarn affected:test --files=libs/mylib/src/index.ts,libs/mylib2/src/index.ts`. Nx will test what is affected by changing the two index files.
- `npm run affected:test -- --uncommitted` or `yarn affected:test --uncommitted`. Nx will test what is affected by the uncommitted files (this is useful during development).
- `npm run affected:test -- --untracked` or `yarn affected:test --untracked`. Nx will test what is affected by the untracked files (this is useful during development).

All other options will be passed into the underlying test command (e.g., `yarn affected:test --base=origin/master --base=HEAD --sm=false`).

## affected:e2e

Run `npm run affected:e2e -- --help` or `yarn affected:e2e --help` to see the available options:

```console
Run e2e tests for the applications affected by changes

Run command using --base=[SHA1] (affected by the committed, uncommitted and
untracked changes):
  --base  Base of the current branch (usually master)                   [string]

or using --base=[SHA1] --head=[SHA2] (affected by the committed changes):
  --base  Base of the current branch (usually master)                   [string]
  --head  Latest commit of the current branch (usually HEAD)            [string]

or using:
  --files        A list of files delimited by commas                     [array]
  --uncommitted  Uncommitted changes
  --untracked    Untracked changes

Options:
  --help         Show help                                             [boolean]
  --version      Show version number                                   [boolean]
  --all          All projects
  --exclude      Exclude certain projects from being processed
                                                           [array] [default: []]
  --only-failed  Isolate projects which previously failed
                                                      [boolean] [default: false]
```

- `npm run affected:e2e -- --base=[SHA1] --base=[SHA2]` or `yarn affected:e2e --base=[SHA1] --base=[SHA2]`. Nx will calculate what changed between the two SHAs, and will run e2e test for the apps affected by the change. For instance, `yarn affected:test --base=origin/master --base=HEAD` will retest what is affected by a PR.
- `npm run affected:e2e -- --files=libs/mylib/src/index.ts,libs/mylib2/src/index.ts` or `yarn affected:e2e --files=libs/mylib/src/index.ts,libs/mylib2/src/index.ts`. Nx will run e2e tests for what is affected by changing the two index files.
- `npm run affected:e2e -- --uncommitted` or `yarn affected:e2e --uncommitted`. Nx will run e2e tests for what is affected by the uncommitted files (this is useful during development).
- `npm run affected:e2e -- --untracked` or `yarn affected:e2e --untracked`. Nx will run e2e tests for what is affected by the untracked files (this is useful during development).

All other options will be passed into the underlying test command (e.g., `yarn affected:test --base=origin/master --base=HEAD --sm=false`).
