# Contributing to Nx

We would love for you to contribute to Nx! Read this document to see how to do it.

## How to Get Started Video

Watch this 5-minute video:

<a href="https://www.youtube.com/watch?v=8LCA_4qxc08" target="_blank" rel="noreferrer">
<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/how-to-contribute.png" width="600" alt="Nx - How to contribute"></p>
</a>

## Got a Question?

We are trying to keep GitHub issues for bug reports and feature requests. Using the `nrwl` tag
on [Stack Overflow](https://stackoverflow.com/questions/tagged/nrwl) is a much better place to ask general questions
about how to use Nx.

## Found an Issue?

If you find a bug in the source code or a mistake in the documentation, you can help us
by [submitting an issue](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-issue)
to [our GitHub Repository](https://github.com/nrwl/nx). Even better, you
can [submit a Pull Request](https://github.com/nrwl/nx/blob/master/CONTRIBUTING.md#submit-pr) with a fix.

## Project Structure

Source code and documentation are included in the top-level folders listed below.

- `packages` - Source code for Nx packages such as Angular, React, Web, NestJS, Next and others including generators and
  executors (or builders).
- `e2e` - E2E tests for the Nx packages
- `graph` - Source code for the Nx Graph application which shows the project graph, task graph, project details, and more in the browser.
- `docs` - Markdown and configuration files for documentation including tutorials, guides for each supported platform,
  and API docs.
- `nx-dev` - Source code for the Nx documentation site which displays the markdown in `docs` and more.
- `tools` - Workspace-specific tooling and plugins
- `scripts` - Miscellaneous scripts for project tasks such as building documentation, testing, and code formatting.
- `tmp` - Folder used by e2e tests. If you are a WebStorm user, make sure to mark this folder as excluded.

## Technologies

This repo contains a mix of different technologies, including:

- **Rust**: The core of Nx is written in Rust, which provides performance and safety.
- **TypeScript**: The primary language for Nx packages and the Nx DevKit.
- **Kotlin**: Used for the Gradle and Java plugins.

## Development Workstation Setup

If you are using `VSCode`, and provided you have [Docker](https://docker.com) installed on your machine, then you can leverage [Dev Containers](https://containers.dev) through this [VSCode extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers), to easily setup your development environment, with everything needed to contribute to Nx, already installed (namely `NodeJS`, `Yarn`, `Rust`, `Cargo`, plus some useful extensions like `Nx Console`).

To do so, simply:

- Checkout the repo
- Open it with VSCode
- Open the [Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette) and select "Dev Containers: Open Folder in Container..."

The repo comes with a preconfigured `devcontainer.json` file (located in `.devcontainer/` folder at root), that `VSCode` will automatically use to install the aforementioned tools, inside a Docker image. It will even run `pnpm install` for you, so you can start contributing to Nx right after.

If you open the repo in [Github Codespace](https://github.com/features/codespaces), it will also leverage this config file, to setup the codespace, with the same required tools.

> 💡 **Troubleshooting**
>
> If you are having issues when running Nx commands like `build`, `test`... related to the version of `GLIBC`,
> it probably means the version that is installed on the devcontainer, **is outdated** compare to the minimum version required by Nx tools.
>
> You can check currently installed version by running the following command, in a terminal within the container:
>
> `ldd --version`
>
> Then, try updating the base image used in [devcontainer.json](.devcontainer/devcontainer.json) and rebuild it, to see if it solved the issue.
>
> Current base image is `"mcr.microsoft.com/devcontainers/typescript-node:20-bookworm"` which is based on `Debian-12 (bookworm)`,
> which comes with `GLIBC v2.36` pre-installed (Nx tools currenlty requires `GLIBC v2.33` or higher).

## Building the Project

> 💡 Nx uses `Rust` to build native bindings for Node. Please make sure that you have Rust installed via [rustup.rs](https://rustup.rs)
> If you have `VSCode` + `Docker`, this can be automated for you, see [section](#development-workstation-setup) above

After cloning the project to your machine, to install the dependencies, run:

```bash
pnpm install

// or prefer...

pnpm install --frozen-lockfile // if you haven't changed any dependency
```

To build all the packages, run:

```bash
pnpm build
```

## Publishing to a local registry

To test if your changes will actually work once the changes are published,
it can be useful to publish to a local registry.

Check out [this video for a live walkthrough](https://youtu.be/Tx257WpNsxc) or follow the instructions below:

- Run `pnpm local-registry` in Terminal 1 (keep it running)
- Run `npm adduser --registry http://localhost:4873` in Terminal 2 (real credentials are not required, you just need to
  be logged in. You can use test/test/test@test.io.)
- Run `pnpm nx-release 20.0.0 --local` in Terminal 2 - you can choose any nonexistent version number here, but it's recommended to use the next major
- Run `cd ./tmp` in Terminal 2
- Run `npx create-nx-workspace@20.0.0` in Terminal 2

If you have problems publishing, make sure you use Node 18 and NPM 8.

**NOTE:** To use this newly published local version, you need to make a new workspace, run `nx migrate` or change all of your target packages to this new version, eg: `"nx": "^20.0.0",` and re-run `pnpm i` in your testing project.

### Publishing for Yarn 2+ (Berry)

Yarn Berry operates slightly differently than Yarn Classic. In order to publish packages for Berry follow next steps:

- Run `yarn set version berry` to switch to latest Yarn version.
- Create `.yarnrc.yml` in root with following contents:

  ```yml
  nodeLinker: node-modules
  npmRegistryServer: 'http://localhost:4873'
  unsafeHttpWhitelist:
    - localhost
  ```

- Run `pnpm local-registry` in Terminal 1 (keep it running)
- If you are creating nx workspace outside of your nx repo, make sure to add npm registry info to your root yarnrc (
  usually in ~/.yarnrc.yml). The file should look something like this:

  ```yml
  npmRegistries:
    'https://registry.yarnpkg.com':
      npmAuthToken: npm_******************
  yarnPath: .yarn/releases/yarn-3.2.2.cjs
  npmRegistryServer: 'http://localhost:4873'
  unsafeHttpWhitelist:
    - localhost
  ```

- Run `pnpm nx-release minor --local` in Terminal 2 to publish next minor version. The output will report the version of published packages.
- Go to your target folder (e.g. `cd ./tmp`) in Terminal 2
- Run `yarn dlx create-nx-workspace@123.4.5` in Terminal 2 (replace `123.4.5` with the version that got published).

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

**Use Node 18 and NPM 8. E2E tests won't work on Node 15 and NPM 7.**

To make sure your changes do not break any E2E tests, run:

```bash
nx e2e e2e-vite # or any other project here
```

Running E2E tests can take some time, so it is often useful to run a single test. To run a single suite of tests, run:

```bash
nx e2e e2e-vite -t versions # I often add qqqq to my test name so I can use -t qqqq
```

Sometimes tests pass locally but they fail on the CI. To reproduce the CI environment and be able to debug the issue, run:

```bash
NX_VERBOSE_LOGGING=true CI=true SELECTED_PM=pnpm pnpm nx e2e e2e-vite --t="should do something is this test"
```

The above command sets verbose logging (this exposes stack traces and underlying errors), sets the defaults to be CI-like and sets Pnpm as the selected package manager.

### Developing on Windows

To build Nx on Windows, you need to use WSL.

- Run `pnpm install` in WSL. Yarn will compile several dependencies. If you don't run `install` in WSL, they will be
  compiled for Windows.
- Run `nx affected --target=test` and other commands in WSL.

## Documentation Contributions

We would love for you to contribute to our documentation as well! Please feel welcome to submit fixes or enhancements to
our existing documentation pages, `astro-docs` and the `nx-dev` application in this repo.

### Documentation Structure

#### Documentation Pages

Our documentation pages can be found within this repo under the `astro-docs/src/content/docs` directory.

Documentation is written in `.mdoc` (Markdoc) or `.mdx` (MDX) format and supports custom Markdoc tags for rich content
such as videos, graphs, interactive components, and more. See the `astro-docs/README.md` for a full list of available
custom tags and their usage.

The sidebar structure is defined in `astro-docs/sidebar.mts` and should be updated when adding new sections or pages
to ensure proper navigation.

#### Astro-Docs Application

Our public `nx.dev/docs` documentation site is built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build),
and can be found in the `astro-docs` directory of this repo. See [docs README for more details](./astro-docs/README.md)

#### Nx-Dev Application

The `nx-dev` directory contains a [Next.js](https://nextjs.org/) application used for blog posts and landing pages.

Jump to [Running the Documentation Site Locally](#running-the-documentation-site-locally) to see how to preview your
changes while serving.

### Changing Generated API documentation

API documentation for CLI commands, executors, and generators is automatically generated during the build process from
the corresponding `schema.json` files in each package.

The documentation is generated using content loaders in the `astro-docs` application and requires a rebuild to reflect
changes. After adjusting a `schema.json` file:

1. Restart the development server with `nx serve astro-docs` to see the changes
2. Or run `nx preview astro-docs` to view the built site locally

Note that adjusting the `schema.json` files will also affect the CLI manuals and Nx Console behavior, in addition to
the generated documentation.

### Running the Documentation Site Locally

To run the documentation site locally, run the command:

```shell
nx serve astro-docs
```

You can then access the application locally at `localhost:4321`. Changes to markdoc files should reflect automatically in the browser on save.

#### Working with Plugin Registry

To view plugin registry statistics (GitHub stars, npm downloads, etc.) during local development:

```bash
NX_DOCS_PLUGIN_STATS=true nx serve astro-docs
```

Note: Plugin stats are disabled by default in development to improve performance.

### PR Preview

When submitting a PR, this repo will automatically generate a preview of the documentation site based on the contents
of your pull request.

Once the preview site is launched, a comment will automatically be added to your PR with the link to your PR's preview.

## Submission Guidelines

### <a name="submit-issue"></a> Submitting an Issue

Before you submit an issue, please search the issue tracker. An issue for your problem may already exist and has been
resolved, or the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it. Having a
reproducible scenario gives us wealth of important information without going back and forth with you requiring
additional information, such as:

- the output of `nx report`
- `yarn.lock` or `package-lock.json` or `pnpm-lock.yaml`
- and most importantly - a use-case that fails

A minimal reproduction allows us to quickly confirm a bug (or point out a coding problem) as well as confirm that we are
fixing the right problem.

We will be insisting on a minimal reproduction in order to save maintainers' time and ultimately be able to fix more
bugs. Interestingly, from our experience, users often find coding problems themselves while preparing a minimal
reproduction repository. We understand that sometimes it might be hard to extract essentials bits of code from a larger
codebase, but we really need to isolate the problem before we can fix it.

You can file new issues by filling out our [issue form](https://github.com/nrwl/nx/issues/new/choose).

### <a name="submit-pr"></a> Submitting a PR

Please follow the following guidelines:

- Make sure unit tests pass (`nx affected --target=test`)
  - Target a specific project with: `nx run proj:test` (i.e. `nx run angular:test` to target `packages/angular`)
  - Target a specific unit test file (i.e. `packages/angular/src/utils/ast-command-line-utils.spec.ts`)
    with `npx jest angular/src/utils/ast-utils` or `npx jest packages/angular/src/utils/ast-utils`
  - For more options on running tests - check `npx jest --help` or visit [jestjs.io](https://jestjs.io/)
  - Debug with `node --inspect-brk ./node_modules/jest/bin/jest.js build/packages/angular/src/utils/ast-utils.spec.js`
- Make sure e2e tests pass (this can take a while, so you can always let CI check those) (`nx affected --target=e2e`)
  - Target a specific e2e test with `nx e2e e2e-cypress`
- Make sure you run `nx format`
- Update documentation with `pnpm documentation`. For documentation, check for spelling and grammatical errors.
- Update your commit message to follow the guidelines below (use `pnpm commit` to automate compliance)
  - `pnpm check-commit` will check to make sure your commit messages are formatted correctly

#### Commit Message Guidelines

The commit message should follow the following format:

```plain
type(scope): subject
BLANK LINE
body
```

##### Type

The type must be one of the following:

- feat - New or improved behavior being introduced (e.g. Updating to new versions of React or Jest which bring in new
  features)
- fix - Fixes the current unexpected behavior to match expected behavior (e.g. Fixing the library generator to create
  the proper named project)
- cleanup - Code Style changes that have little to no effect on the user (e.g. Refactoring some functions into a
  different file)
- docs - Changes to the documentation (e.g. Adding more details into the getting started guide)
- chore - Changes that have absolutely no effect on users (e.g. Updating the version of Nx used to build the repo)

##### Scope

The scope must be one of the following:

- angular - anything Angular specific
- bundling - anything bundling specific (e.g. rollup, webpack, etc.)
- core - anything Nx core specific
- detox - anything Detox specific
- devkit - devkit-related changes
- graph - anything graph app specific
- expo - anything Expo specific
- express - anything Express specific
- js - anything related to @nx/js package or general js/ts support
- linter - anything Linter specific
- module-federation - anything Nx Module Federation specific
- nest - anything Nest specific
- nextjs - anything Next specific
- node - anything Node specific
- nx-cloud - anything Nx Cloud specific
- nx-plugin - anything Nx Plugin specific
- nx-dev - anything related to docs infrastructure
- react - anything React specific
- react-native - anything React Native specific
- release - anything related to nx release
- repo - anything related to managing the Nx repo itself
- storybook - anything Storybook specific
- testing - anything testing specific (e.g., Jest or Cypress)
- vite - anything Vite specific
- vue - anything Vue specific
- web - anything Web specific
- webpack - anything Webpack specific
- misc - misc stuff

##### Subject and Body

The subject must contain a description of the change, and the body of the message contains any additional details to
provide more context about the change.

Including the issue number that the PR relates to also helps with tracking.

#### Example

```plain
feat(angular): add an option to generate lazy-loadable modules

`nx generate lib libs/mylib --lazy` provisions the mylib project in .eslintrc.json

Closes #157
```

#### Commitizen

To simplify and automate the process of committing with this format,
**Nx is a [Commitizen](https://github.com/commitizen/cz-cli) friendly repository**, just do `git add` and
execute `pnpm commit`.

##### Using the Interactive Commit Tool

Instead of `git commit`, use:

```bash
pnpm commit
```

This will launch an interactive prompt that will:

1. Ask you to select the type of change (feat, fix, docs, cleanup, chore)
2. Let you choose the appropriate scope from the predefined list
3. Guide you through writing a clear, descriptive commit message
4. Ensure your commit follows the conventional commit format

##### Available Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **cleanup**: A code change that neither fixes a bug nor adds a feature
- **chore**: Other changes that don't modify src or test files

##### Available Scopes

The repository includes many predefined scopes. Use the one which is most specific to the changes being committed

- **core**: anything Nx core specific
- **angular**: anything Angular specific
- **react**: anything React specific
- **nextjs**: anything Next specific
- **node**: anything Node specific
- **devkit**: devkit-related changes
- **graph**: anything graph app specific
- **testing**: anything testing specific (e.g. jest or cypress)
- **misc**: misc stuff
- **repo**: anything related to managing the repo itself
- **nx-dev**: anything related to docs infrastructure

For the complete list of available scopes, see `/scripts/commitizen.js`.

##### Example Commits

```bash
feat(core): add new project graph visualization
fix(angular): resolve build issues with standalone components
docs(misc): update contributing guidelines
chore(repo): bump dependencies
cleanup(devkit): refactor utility functions for better readability
```

#### PR releases

If you are working on a particularly complex change or feature addition, you can request a dedicated Nx release for the associated pull request branch. Mention someone from the Nx team or the `@nrwl/nx-pipelines-reviewers` and they will confirm if the PR warrants its own release for testing purposes, and generate it for you if appropriate.
