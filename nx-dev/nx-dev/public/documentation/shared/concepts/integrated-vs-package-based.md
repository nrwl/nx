# Integrated Repos vs. Package-Based Repos vs. Standalone Apps

There are many different ways to structure a repository and Nx is designed to support them all. To better discuss how Nx can improve a repository, it is helpful to define some terms.

- Standalone Application - A repository with a single application
- Package-Based Repository - A repository with multiple projects that depend on each other via `package.json` and often have nested `node_modules`
- Integrated Repository - A repository with multiple projects that depend on each other via typescript imports and often employ a single version policy

Nx's features can be enabled in each of these types of repositories. Just as each repository is unique and may not exactly fit in one of these categories, the way Nx is used will vary between repositories.

{% cards %}
{% card title="Packaged based vs Integrated Style - Use Nx however it works best for you" description="Choose your style and what works best for you!" type="video" url="https://youtu.be/ArmERpNvC8Y" /%}
{% card title="Getting Started with Package-Based Repos" description="Walkthrough for creating a package-based monorepo with Nx" type="video" url="https://youtu.be/hzTMKuE3CDw" /%}
{% card title="Getting Started with Integrated Repos" description="Walkthrough for creating an integrated monorepo with Nx" type="video" url="https://youtu.be/weZ7NAzB7PM" /%}
{% /cards %}

## Package-Based Repos

A package-based repo is a collection of packages that depend on each other via `package.json` files and nested `node_modules`. With this setup, you typically have [different dependencies for each project](/concepts/decisions/dependency-management). Build tools like Jest and Webpack work as usual, since everything is resolved as if each package was in a separate repo and all of its dependencies were published to npm. Moving an existing package into a package-based repo is very easy since you generally leave that package's existing build tooling untouched. Creating a new package inside the repo is just as difficult as spinning up a new repo since you have to create all the build tooling from scratch.

Lerna, Yarn, Lage, [Turborepo](/concepts/turbo-and-nx) and Nx support this style.

Someone who appreciates the flexibility of a package-based repository will be most interested in the following features of Nx:

- Add [caching](/features/cache-task-results) and [task orchestration](/features/run-tasks) without modifying tooling or file structure
- Import existing projects into the repo without modifying their tooling
- Easily create new projects or tools with [code generators](/features/generate-code)

{% cards %}
{% card title="NPM Workspaces Tutorial" description="Add Nx to an existing NPM workspaces repo" type="documentation" url="/getting-started/tutorials/npm-workspaces-tutorial" /%}
{% /cards %}

## Integrated Repos

An integrated repo contains projects that depend on each other through standard import statements. There is typically a [single version of every dependency](/concepts/decisions/dependency-management) defined at the root. Sometimes build tools like Jest and Webpack need to be wrapped to work correctly. It's harder to add an existing package to this repo style because the build tooling for that package may need to be modified. It's straightforward to add a brand-new project to the repo because all the tooling decisions have already been made.

Bazel and Nx support this style.

Someone who appreciates the structure and consistency of an integrated repository will be most interested in the following features of Nx:

- [Enforce architectural decisions](/features/enforce-module-boundaries) with tagging rules
- Encourage consistency with custom [code generators](/features/generate-code)
- [Automate updating dependencies](/features/automate-updating-dependencies) of the entire toolchain

{% cards %}
{% card title="Tutorial: React Monorepo" description="Create a React monorepo with Nx" type="documentation" url="/getting-started/tutorials/react-monorepo-tutorial" /%}
{% card title="Tutorial: Angular Monorepo" description="Create an Angular monorepo with Nx" type="documentation" url="/getting-started/tutorials/angular-monorepo-tutorial" /%}
{% /cards %}

## Standalone Applications

Nx plugins, especially the [generators](/features/generate-code), [executors](/concepts/executors-and-configurations) and [migrations](/features/automate-updating-dependencies) that come with them, are not only valuable for a monorepo scenario. In fact, many developers use Nx not primarily for its monorepo support, but for its tooling support, particularly its ability to modularize a codebase and, thus, better scale it. Nx supports standalone applications, which are like an integrated monorepo setup, but with just a single, root-level application. Think of it as an advanced, more capable Create-React-App or Angular CLI. And obviously, you can still leverage all the generators and executors and structure your application into libraries or submodules.

Someone whose main focus is on improving their single application will be most interested in the following features of Nx:

- Set up a [fast CI system](/ci/intro/ci-with-nx) without CI expertise
- Easily [add new tooling](/plugin-registry)

{% cards %}
{% card title="Standalone Applications with Nx" description="Learn what Standlone Apps are and how Nx can be useful" type="video" url="https://youtu.be/qEaVzh-oBBc" /%}
{% card title="Tutorial: React Standalone Tutorial" description="Walkthrough for creating a React standalone application with Nx" type="documentation" url="/getting-started/tutorials/react-standalone-tutorial" /%}
{% card title="Tutorial: Angular Standalone Tutorial" description="Walkthrough for creating an Angular standalone application with Nx" type="documentation" url="/getting-started/tutorials/angular-standalone-tutorial" /%}
{% /cards %}

## How to Choose

Nx itself doesn't care which style you choose. You can use all the features of Nx whether you are in a package based repo or integrated repo. Certain Nx features will be more or less valuable for a standalone app, but all the features of Nx are still available to be put in place as soon as that repo grows to include more apps.

You can be successful working in any style, and there are ways to transition between them. At a high level

- **standalone apps -** for when you want a single project that can be nicely structured and modularized. It's a good starting point if you're not looking into a monorepo but with the option to expand later.
- **package-based repos -** ideally when you already have a monorepo (e.g. yarn/npm/pnpm workspace) and you want Nx primarily for speed and task scheduling. Also, when you want Nx to stay mostly out of your way and you set up everything on your own.
- **integrated repos -** when you want more help from Nx. It takes away the burden of the configuration by coming up with a pre-configured setup that scales well, and provides scaffolding support and automated code migrations. Organizations choose this approach if they are bought into monorepos and want to scale up. Integrated repos might restrict some choices to allow Nx to help you more but result in better maintainability and more value in the long run.

The comparison between package-based repos and integrated repos is similar to that between JSDoc and TypeScript. The former is easier to adopt and provides some good benefits. The latter takes more work but offers more value, especially at a larger scale.
