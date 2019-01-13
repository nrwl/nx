# Contributing to Nx

We would love for you to contribute to Nx! Read this document to see how to do it.

## Got a Question?

We are trying to keep GitHub issues for bug reports and feature requests. Stack Overflow is a much better place to ask general questions about how to use Nx.

## Found an Issue?

If you find a bug in the source code or a mistake in the documentation, you can help us by [submitting an issue](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-issue) to [our GitHub Repository](https://github.com/nrwl/nx). Even better, you can [submit a Pull Request](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-pr) with a fix.

## Building the Project

After cloning the project run: `yarn`.

After that run `yarn build` to build the `bazel`, `nx`, and `schematics` packages.

After that run `yarn linknpm`.

### Running Unit Tests

To make sure your changes do not break any unit tests, run the following:

```bash
yarn test
```

You can also run `yarn test:schematics` and `yarn test:nx` to test the schematics and nx packages individually.

If you need to test only the **collection/ngrx.spec.ts** test [for example], you can use an optional `$1` argument as follows:

```bash
yarn test:schematics schematics/src/collection/ngrx/ngrx
```

### Running E2E Tests

To make sure you changes do not break any unit tests, run the following:

```bash
yarn e2e
```

Running e2e tests can take some time, so if it often useful to run a single test. You can do it as follows:

```bash
yarn e2e affected
```

### Developing on Windows

To build Nx on Windows, you need to use WSL.

- Run `yarn install` in WSL. Yarn will compile several dependencies. If you don't run `install` in WSL, they will be compiled for Windows.
- Run `yarn test:scheamtics` and other commands in WSL.

## Submission Guidelines

### <a name="submit-issue"></a> Submitting an Issue

Before you submit an issue, please search the issue tracker, maybe an issue for your problem already exists and the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it. Having a reproducible scenario gives us wealth of important information without going back & forth to you with additional questions like:

- version of Nx used
- version of Angular CLI used
- `angular.json` configuration
- version of Angular DevKit used
- 3rd-party libraries and their versions
- and most importantly - a use-case that fails

A minimal reproduce scenario using allows us to quickly confirm a bug (or point out coding problem) as well as confirm that we are fixing the right problem.

We will be insisting on a minimal reproduce scenario in order to save maintainers time and ultimately be able to fix more bugs. Interestingly, from our experience users often find coding problems themselves while preparing a minimal repository. We understand that sometimes it might be hard to extract essentials bits of code from a larger code-base but we really need to isolate the problem before we can fix it.

You can file new issues by filling out our [issue form](https://github.com/nrwl/nx/issues/new).

### <a name="submit-pr"></a> Submitting a PR

Please follow the following guidelines:

- Make sure unit tests pass
- Make sure e2e tests pass
- Make sure you run `yarn format`
- Update your commit message to follow the guidelines below

#### Commit Message Guidelines

Commit message should follow the following format:

```
type(scope): subject
BLANK LINE
body
```

##### Type

The type must be one of the following:

- build
- feat
- fix
- refactor
- style
- docs
- test

##### Scope

The scope must be one of the following:

- bazel
- nx
- schematics

##### Subject

The subject must contain a description of the change.

#### Example

```
feat(schematics): add an option to generate lazy-loadable modules

`ng generate lib mylib --lazy` provisions the mylib project in tslint.json
```

#### Commitizen

To simplify and automate the process of commiting with this format,
**Nx is a [Commitizen](https://github.com/commitizen/cz-cli) friendly repository**, just do `git add` and execute `yarn commit`.

## Migrations

Nx allows users to automatically upgrade to the newest version of the package. If you are introducing a change that would require the users to upgrade their workspace, add a migration to `packages/schematics/migrations`.

Migrations are named in the following fashion: `YYYYMMDD-name.ts` (e.g., 20171129-change-schema.ts).

The `yarn nx-migrate` command will run all the migrations after the one encoded in .angular-cli.json.
