# Installation

<iframe src="https://player.vimeo.com/video/237418773" width="100%" height="360" frameborder="0" allowfullscreen></iframe>

Nrwl Extensions, or **Nx** for short, is **an extension for the the Angular CLI implementing the monorepo-style development**. It is also **a collection of runtime libraries, linters, and code generators** helping large teams build better with Angular. It is made up of the following packages:

- **@nrwl/schematics**:Code generators and command-line tools (this is a dev dependency)
- **@nrwl/nx**: Helpers and utilities that can be used by your application (this is a runtime dependency)

Both of these packages are included when creating an Nx Workspace.

Nx has two tags for available versions:

- **latest** (current stable version)
- **next** (still in development but close!)

## Installing Nx

An Nx workspace is an Angular CLI project that has been enhanced to be enterprise ready. Being an Angular CLI project means it will be handy to have the Angular CLI installed globally, which can be done via npm or yarn as well.

```bash
npm install -g @angular/cli
```

or

```bash
yarn global add @angular/cli
```

> Note: If you do not have the Angular CLI installed globally you may not be able to use ng from the terminal to run CLI commands within the project. But the `package.json` file comes with npm scripts to run ng commands, so you can run npm start to ng serve and you can run `npm run ng <command>` to run any of the ng commands.

After you have installed the Angular CLI, install `@nrwl/schematics`.

```bash
npm install -g @nrwl/schematics
```

or

```bash
yarn global add @nrwl/schematics
```

> If you want to work with the version still in development you can use `@nrwl/schematics@next` as the package to install.
