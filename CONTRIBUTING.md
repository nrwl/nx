# Contributing to Nx

We would love for you to contribute to Nx! Read this document to see how to do it.

## How to Get Started Video

Watch this 5-minute video:

<a href="https://www.youtube.com/watch?v=8LCA_4qxc08" target="_blank">
<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/how-to-contribute.png" width="600" alt="Nx - How to contribute"></p>
</a>

## Got a Question?

We are trying to keep GitHub issues for bug reports and feature requests. Using the `nrwl` tag on [Stack Overflow](https://stackoverflow.com/questions/tagged/nrwl) is a much better place to ask general questions about how to use Nx.

## Found an Issue?

If you find a bug in the source code or a mistake in the documentation, you can help us by [submitting an issue](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-issue) to [our GitHub Repository](https://github.com/nrwl/nx). Even better, you can [submit a Pull Request](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-pr) with a fix.

## Project Structure

Source code and documentation are included in the top-level folders listed below.

- `docs` - Markdown and configuration files for documentation including tutorials, guides for each supported platform, and API docs.
- `e2e` - E2E tests.
- `packages` - Source code for Nx packages such as Angular, React, Web, NestJS, Next and others including generators and executors (or builders).
- `scripts` - Miscellaneous scripts for project tasks such as building documentation, testing, and code formatting.
- `tmp` - Folder used by e2e tests. If you are a WebStorm user, make sure to mark this folder as excluded.

## Building the Project

After cloning the project to your machine, to install the dependencies, run:

```bash
yarn
```

To build all the packages, run:

```bash
yarn build
```

## Publishing to a local registry

To test if your changes will actually work once the changes are published,
it can be useful to publish to a local registry.

Check out [this video for a live walkthrough](https://youtu.be/Tx257WpNsxc) or follow the instructions below:

```bash
# Starts the local registry. Keep this running in a separate terminal.
yarn local-registry start

# Set npm and yarn to use the local registry.
# Note: This reroutes your installs to your local registry
yarn local-registry enable

# Revert npm and yarn to use their default registries
yarn local-registry disable
```

To publish packages to a local registry, do the following:

- Run `yarn local-registry start` in Terminal 1 (keep it running)
- Run `npm adduser --registry http://localhost:4873` in Terminal 2 (real credentials are not required, you just need to be logged in. You can use test/test/test@test.io.)
- Run `yarn local-registry enable` in Terminal 2
- Run `yarn nx-release 999.9.9 --local` in Terminal 2
- Run `cd ./tmp` in Terminal 2
- Run `npx create-nx-workspace@999.9.9` in Terminal 2

If you have problems publishing, make sure you use Node 14 and NPM 6 instead of Node 15 and NPM 7.

### Running Unit Tests

To make sure your changes do not break any unit tests, run the following:

```bash
nx affected --target=test
```

For example, if you need to only run the tests for the jest package, run:

```bash
nx test jest
```

### Running E2E Tests

**Use Node 14 and NPM 6. E2E tests won't work on Node 15 and NPM 7.**

To make sure your changes do not break any E2E tests, run:

```bash
nx e2e e2e-cli # or any other project here
```

Running E2E tests can take some time, so it is often useful to run a single test. To run a single suite of tests, run:

```bash
nx e2e e2e-cli -t versions # I often add qqqq to my test name so I can use -t qqqq
```

### Developing on Windows

To build Nx on Windows, you need to use WSL.

- Run `yarn install` in WSL. Yarn will compile several dependencies. If you don't run `install` in WSL, they will be compiled for Windows.
- Run `nx affected --target=test` and other commands in WSL.

## Documentation Contributions

We would love for you to contribute to our documentation as well! Please feel welcome to submit fixes or enhancements to our existing documentation pages and the `nx-dev` application in this repo.

### Documentation Structure

#### Documentation Pages

Our documentation pages can be found within this repo under the `docs` directory. Pages that we consider framework specific are nested in their own subdirectories - otherwise they should be nested within the `docs/shared` directory.

The `docs/map.json` file is considered our source of truth for our site's structure, and should be updated when adding a new page to our documentation to ensure that it is included in the documentation site. We also run automated scripts based on this `map.json` data to safeguard against common human errors that could break our site.

#### Nx-Dev Application

Our public `nx.dev` documentation site is a [Next.js](https://nextjs.org/) application, that can be found in the `nx-dev` directory of this repo.

The `nx-dev/nx-dev/public/documentation` directory contains `.md` files that are generated from the `docs` directory when new releases are cut. As such, these should not be changed when submitting a change to existing docs.

Jump to [Running the Documentation Site Locally](#running-the-documentation-site-locally) to see how to preview your changes while serving.

### Changing Generated API documentation

`.md` files documenting the API for our CLI (including executor and generator API docs) are generated via the corresponding `schema.json` file for the given command.

After adjusting the `schema.json` file, `.md` files for these commands can be generated by running:

```bash
yarn documentation
```

This will update the corresponding contents of the `docs` directory. These are generated automatically on push (via husky) as well.

Note that adjusting the `schema.json` files will also affect the CLI manuals and Nx Console behavior, in addition to adjusting the docs.

### Running the Documentation Site Locally

To run `nx-dev` locally, run the command:

```bash
npx nx serve nx-dev
```

You can then access the application locally at `localhost:4200`.

By default, the site displays the `Latest` cut release of the docs. To see your current changes in the docs be sure to select `Preview` from the version selection box of the site.

<img src="https://raw.githubusercontent.com/nrwl/nx/master/images/selecting-preview-from-version-selection-box.png" width="600" alt="Selecting Preview from Version Selection box">

### PR Preview

When submitting a PR, this repo will automatically generate a preview of the `nx-dev` application based on the contents of your pull request.

Once the preview site is launched, a comment will automatically be added to your PR with the link your your PR's preview. To check your docs changes, make sure to select `Preview` from the version selection box of the site.

## Submission Guidelines

### <a name="submit-issue"></a> Submitting an Issue

Before you submit an issue, please search the issue tracker. An issue for your problem may already exist and has been resolved, or the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it. Having a reproducible scenario gives us wealth of important information without going back and forth with you requiring additional information, such as:

- the output of `nx report`
- `yarn.lock` or `package-lock.json`
- and most importantly - a use-case that fails

A minimal reproduction allows us to quickly confirm a bug (or point out coding problem) as well as confirm that we are fixing the right problem.

We will be insisting on a minimal reproduction in order to save maintainers time and ultimately be able to fix more bugs. Interestingly, from our experience, users often find coding problems themselves while preparing a minimal repository. We understand that sometimes it might be hard to extract essentials bits of code from a larger code-base but we really need to isolate the problem before we can fix it.

You can file new issues by filling out our [issue form](https://github.com/nrwl/nx/issues/new).

### <a name="submit-pr"></a> Submitting a PR

Please follow the following guidelines:

- Make sure unit tests pass (`nx affected --target=test`)
  - Target a specific project with: `nx run proj:test` (i.e. `nx run angular:test` to target `packages/angular`)
  - Target a specific unit test file (i.e. `packages/angular/src/utils/ast-utils.spec.ts`) with `npx jest angular/src/utils/ast-utils` or `npx jest packages/angular/src/utils/ast-utils`
  - For more options on running tests - check `npx jest --help` or visit [jestjs.io](https://jestjs.io/)
  - Debug with `node --inspect-brk ./node_modules/jest/bin/jest.js build/packages/angular/src/utils/ast-utils.spec.js`
- Make sure e2e tests pass (this can take a while, so you can always let CI check those) (`yarn e2e`)
  - Target a specific e2e test (i.e. `/build/e2e/cypress.test.js`) with `yarn e2e cypress`
  - Debug with `node --inspect-brk ./node_modules/jest/bin/jest.js build/e2e/cypress.test.js`
- Make sure you run `yarn format`
- Update documentation with `yarn documentation`. For documentation, check for spelling and grammatical errors.
- Update your commit message to follow the guidelines below (use `yarn commit` to automate compliance)
  - `yarn check-commit` will check to make sure your commit messages are formatted correctly

#### Commit Message Guidelines

The commit message should follow the following format:

```
type(scope): subject
BLANK LINE
body
```

##### Type

The type must be one of the following:

- feat - New or improved behavior being introduced (e.g. Updating to new versions of React or Jest which bring in new features)
- fix - Fixes the current unexpected behavior to match expected behavior (e.g. Fixing the library generator to create the proper named project)
- cleanup - Code Style changes that have little to no effect on the user (e.g. Refactoring some functions into a different file)
- docs - Changes to the documentation (e.g. Adding more details into the getting started guide)
- chore - Changes that have absolutely no effect on users (e.g. Updating the version of Nx used to build the repo)

##### Scope

The scope must be one of the following:

- core - anything Nx core specific
- js - anything related to @nrwl/js package or general js/ts support
- nxdev - anything related to docs infrastructure
- nextjs - anything Next specific
- nest - anything Nest specific
- node - anything Node specific
- linter - anything Linter specific
- react - anything React specific
- web - anything Web specific
- storybook - anything Storybook specific
- testing - anything testing specific (e.g., jest or cypress)
- repo - anything related to managing the repo itself
- angular - anything Angular specific
- misc - misc stuff
- devkit - devkit-related changes

##### Subject and Body

The subject must contain a description of the change, and the body of the message contains any additional details to provide more context about the change.

Including the issue number that the PR relates to also helps with tracking.

#### Example

```
feat(angular): add an option to generate lazy-loadable modules

`nx generate lib mylib --lazy` provisions the mylib project in tslint.json

Closes #157
```

#### Commitizen

To simplify and automate the process of committing with this format,
**Nx is a [Commitizen](https://github.com/commitizen/cz-cli) friendly repository**, just do `git add` and execute `yarn commit`.
