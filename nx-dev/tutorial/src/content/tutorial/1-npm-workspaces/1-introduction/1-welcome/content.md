---
type: lesson
title: Starting Repository
focus: /package.json
---

In this tutorial, you'll learn how to add Nx to a repository with an existing [NPM workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) setup.

What will you learn?

- how to add Nx to the repository with a single command
- how to configure caching for your tasks
- how to configure a task pipeline
- how to configure projects automatically with Nx Plugins
- how to manage your releases with `nx release`
- [how to speed up CI with Nx Cloud ⚡](#fast-ci)

## Starting Repository

To get started, fork [the sample repository](https://github.com/nrwl/tuskydesign/fork) and clone it on your local machine:

```shell
git clone https://github.com/<your-username>/tuskydesign.git
```

The repository has three TypeScript packages under `packages/animals`, `packages/names` and `packages/zoo`. The `zoo` package uses `animals` and `names` to generate a random message. The root `package.json` has a `workspaces` property that tells NPM how to find the projects in the repository.

```json title="package.json"
{
  "workspaces": ["packages/*"]
}
```

Because of this setting, when the install command is run at the root, the correct packages are installed for each project. NPM will create dedicated `node_modules` folders inside of each project folder where necessary.

```shell
npm install
```

Now let's try running some tasks. To build the `animals` package, use the `build` npm script:

```shell
npm run build -w @tuskdesign/animals
```

The repository is set up using [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html) so building the `zoo` package will automatically build all its dependencies.

```shell
npm run build -w @tuskdesign/zoo
```

To run the `zoo` package use the `serve` script:

```shell
npm run serve -w @tuskdesign/zoo
```

You should see a message like this:

```
Bo the pig says oink!
```

Now that you have a basic understanding of the repository we're working with, let's see how Nx can help us.
