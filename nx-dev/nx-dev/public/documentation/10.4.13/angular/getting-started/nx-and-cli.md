# Nx and Angular CLI

Nx **is not** a replacement for Angular CLI. Under the hood, Nx uses the Angular CLI to generate code and run tasks.

When you run `nx build myapp`, Nx will invoke `ng build myapp` under the hood. When you run `nx g component mycmp`, Nx will invoke `ng g component mycmp` under the hood.

When it comes to generating code and running tasks, since `nx` delegates to `ng`, both CLIs will always produce the same result, except that running `nx` will often run a lot faster.

How?

Nx CLI uses advanced code analysis and computation caching to reuse previous computation results when possible. The Angular CLI doesn't do it. In other words, use `nx` instead of `ng`: everything will work just the same but often much faster.

The `Nx CLI` also supports a lot more commands than the Angular CLI. It can run a target against many projects in parallel, run a target against a project and its dependencies, etc..

**What does Nx add in addition to being faster?**

Here are a few tasks that are made possible by Nx.

## Using effective development practices pioneered at Google

Using Nx, you can implement monorepo-style development--an approach popularized by Google and used by many tech companies today (Facebook, Uber, Twitter, etc..).

_Doesn't Angular CLI support having multiple projects in the same workspace?_

Yes, starting with Angular CLI 6 you can add different types of projects to a single workspace (by default you can add applications and libraries). This is great, but is not sufficient to enable the monorepo-style development. Nx adds an extra layer of tooling to make this possible.

### Analyzing and Visualizing the Dependency Graph

To be able to support the monorepo-style development, the tools must know how different projects in your workspace depend on each other. Nx uses advanced code analysis to build this dependency graph. Run `nx dep-graph` to see the dependency diagram of your workspace.

![Dependency Diagram](./dep-graph.png)

### Rebuilding and Retesting What is Affected

To be productive in a monorepo, you need to be able to check that your change is safe, and rebuilding and retesting everything on every change won’t scale. Nx uses code analysis to determine what needs to be rebuilt and retested.

```bash
nx affected:build # reruns build for all the projects affected by a PR

nx affected:test # reruns unit tests for all the projects affected by a PR
```

Nx will topologically sort the projects, and will run what it can in parallel. Nx will also use its advanced distributed computation caching to drastically speed up your commands.

## Full-Stack Development

With Nx, you can build a backend application next to your frontend application in the same repository. The backend and the frontend can share code. You can connect them to enable a fantastic development experience.

_How do you do it?_

First, generate an Angular application.

```bash
nx g @nrwl/angular:app frontend
```

Second, generate a Nest application.

```bash
nx g @nrwl/nest:app backend --frontend-project frontend # Generate a Nest Application and sets up a proxy for the frontend application.
```

## Use Innovative Tools

Tools like Cypress, Jest, Prettier, and Nest have gained a lot of popularity.

Adding these tools to the dev workflow is challenging in a regular Angular CLI project. The choice you have is not between Protractor or Cypress, but between a hacked-up setup for Cypress and a great CLI setup for Protractor. Nx changes that!

When using Nx, adding Cypress or Jest is easy:

```bash
nx g @nrwl/angular:app myapp --e2e-test-runner=cypress --unit-test-runner=jest # cypress and jest are actually defaults
nx g @nrwl/angular:app myapp --e2e-test-runner=protractor --unit-test-runner=karma
```

Tests can then be run just like you would run them normally:

```bash
nx test myapp
nx e2e myapp
```
