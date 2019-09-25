# Contributing to Nx

We would love for you to contribute to Nx! Read this document to see how to do it.

## Got a Question?

We are trying to keep GitHub issues for bug reports and feature requests. Using the `nrwl` tag on [Stack Overflow](https://stackoverflow.com/questions/tagged/nrwl) is a much better place to ask general questions about how to use Nx.

## Found an Issue?

If you find a bug in the source code or a mistake in the documentation, you can help us by [submitting an issue](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-issue) to [our GitHub Repository](https://github.com/nrwl/nx). Even better, you can [submit a Pull Request](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-pr) with a fix.

## Project Structure

Source code and documentation are included in the top-level folders listed below.

- `docs` - Markdown and configuration files for documentation including tutorials, guides for each supported platform, and API docs.
- `e2e` - E2E tests for Nx packages and schematics.
- `packages` - Source code for Nx packages such as Angular, React, Web, and others including schematics and builders.
- `scripts` - Miscellaneous scripts for project tasks such as building documentation, testing, and code formatting.

## Building the Project

After cloning the project to your machine, to install the dependencies, run:

```bash
yarn
```

To build all the packages, run:

```bash
yarn build
```

### Running Unit Tests

To make sure your changes do not break any unit tests, run the following:

```bash
yarn test
```

For example, if you need to only run the **jest-project/jest-project.spec.ts** test suite, provide a path to the specific spec file, run:

```bash
yarn test jest/src/schematics/jest-project/jest-project
```

### Running E2E Tests

To make sure your changes do not break any E2E tests, run:

```bash
yarn e2e
```

Running E2E tests can take some time, so it is often useful to run a single test. To run a single suite of tests, run:

```bash
yarn e2e affected
```

### Developing on Windows

To build Nx on Windows, you need to use WSL.

- Run `yarn install` in WSL. Yarn will compile several dependencies. If you don't run `install` in WSL, they will be compiled for Windows.
- Run `yarn test` and other commands in WSL.

## Submission Guidelines

### <a name="submit-issue"></a> Submitting an Issue

Before you submit an issue, please search the issue tracker. An issue for your problem may already exist and has been resolved, or the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it. Having a reproducible scenario gives us wealth of important information without going back and forth with you requiring additional information, such as:

- version of Nx used
- `yarn.lock` or `package-lock.json`
- and most importantly - a use-case that fails

A minimal reproduction allows us to quickly confirm a bug (or point out coding problem) as well as confirm that we are fixing the right problem.

We will be insisting on a minimal reproduction in order to save maintainers time and ultimately be able to fix more bugs. Interestingly, from our experience, users often find coding problems themselves while preparing a minimal repository. We understand that sometimes it might be hard to extract essentials bits of code from a larger code-base but we really need to isolate the problem before we can fix it.

You can file new issues by filling out our [issue form](https://github.com/nrwl/nx/issues/new).

### <a name="submit-pr"></a> Submitting a PR

Please follow the following guidelines:

- Make sure unit tests pass
- Make sure e2e tests pass
- Make sure you run `yarn format`
- For documentation, check for spelling and grammatical errors.
- Update your commit message to follow the guidelines below

#### Commit Message Guidelines

The commit message should follow the following format:

```
type(scope): subject
BLANK LINE
body
```

##### Type

The type must be one of the following:

- chore
- build
- feat
- fix
- refactor
- style
- docs

##### Scope

The scope must be one of the following:

- backend - anything backend specific
- testing - anything related to jest or cypress
- web - anything web specific
- react - anything react specific
- angular - anything angular specific
- nx - dependency management, basic workspace structure, anything touching both backend and frontend, and other related areas

##### Subject and Body

The subject must contain a description of the change, and the body of the message contains any additional details to provide more context about the change.

Including the issue number that the PR relates to also helps with tracking.

#### Example

```
feat(schematics): add an option to generate lazy-loadable modules

`nx generate lib mylib --lazy` provisions the mylib project in tslint.json

Closes #157
```

#### Commitizen

To simplify and automate the process of committing with this format,
**Nx is a [Commitizen](https://github.com/commitizen/cz-cli) friendly repository**, just do `git add` and execute `yarn commit`.

## Migrations

Nx allows users to automatically upgrade to the newest version of the package. If you are introducing a change that would require the users to upgrade their workspace, add a migration to `packages/schematics/migrations`.

Migrations are named using version numbers in the following fashion: `update-major-minor-patch/update-major-minor-patch.ts`, for example, `update-8-1-0/update-8-1-0.ts`.
