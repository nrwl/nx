# Manual migration of existing code bases

## What you’ll accomplish

Migrating into an Nx workspace can seem intimidating. While every codebase is unique, we can offer recommendations for how to proceed based on the Nrwl team’s years of experience. The key to success is an incremental approach. You don’t need to migrate your entire codebase at once. Find a good target for migration, move it into your Nx workspace, get it working and stable, and go from there.

This document will introduce you to the Nx workspace, help you get one created, and point you to some particular configuration that you may need for your codebase.

## Create a workspace

To get started, you’ll need an Nx workspace. While Nx offers several preset configurations for your workspace, we recommend starting migration with an `empty` workspace. This will allow you to have finer control over the configuration and creation of the applications and libraries in your workspace.

To create an empty workspace:

```bash
npx create-nx-workspace@latest
```

Select `empty` when prompted:

```bash
? What to create in the new workspace (Use arrow keys)
❯ empty             [an empty workspace with a layout that works best for building apps]
```

## Exploring your workspace

Take a tour of your [Nx workspace](/getting-started/nx-setup). There are some important areas to know about as you migrate.

### apps

The `apps` directory is the place where your top-level applications will be stored. You should always begin your migration journey by adding an application.

For Angular applications:

```bash
npm install --save-dev @nrwl/angular
```

and

```bash
nx generate @nrwl/angular:application my-application
```

For React applications:

```bash
npm install --save-dev @nrwl/react
```

and

```bash
nx generate @nrwl/react:application my-application
```

There are a lot of options when creating your application. If you want to follow Nx recommendations, you can accept the defaults. If you have a well-established codebase, you can configure those options at the time of application generation. You can find documentation for these options for the different frameworks here:

- [Angular](/packages/angular/generators/application)
- [React](/packages/react/generators/application)

You may also find it useful to use the [Nx Console](/using-nx/console) in Visual Studio Code. This will give you a visual way to generate your application with all of the options laid out in front of you.

### Configuration files

Your workspace contains different configuration files for the tools you’ll need to develop, such as linters, bundlers, and executors. There are two sources of configuration files for your workspace: at the root of the workspace and at the root of your application. The configuration files at the root of your application extend the configuration files found at the root of your workspace. If you need to make global adjustments to these configurations, you should do so at the root of the workspace. If you have multiple applications that need different configurations, you should manage this using the configuration files in the root of each application.

In general, you should not replace the configuration files provided for you. You should add to or modify the configurations that are there. This will help ensure that your configuration files are set up for Nx to work at its best.

### Nx Configuration Files

In addition to configuration files for external libraries, your Nx workspace will have configuration files for Nx itself. This will be `angular.json` for workspaces using the Angular CLI and `workspace.json` for workspaces using the Nx CLI. This file will define all of the individual projects in your workspace (of which your application is one) and the tasks available for them.

For example, your generated application should have four [tasks available](/executors/using-builders) for it: `build`, `serve`, `lint`, and `test`. Each of these comes with its own configuration. If you find you need to adjust the configuration of a task for your codebase, this is the place to begin looking.

These workspace configuration files can seem a little long and intimidating. The Nx Console can help you navigate it more easily with its Workspace JSON panel. By clicking on a project in your workspace, it will navigate you to the right place in the workspace file to begin making edits.

Additionally, there is an `nx.json` file that contains metadata about your projects. [This metadata includes tags](/structure/monorepo-tags) that can help you impose constraints on your applications and library dependencies.

## Migrating your code

There are two major steps to migrating your application: migrating your dependencies and migrating your code.

### Dependencies

If you’re already using npm for package management, this is as easy as copying your dependencies from your old `package.json` file to your workspace’s `package.json`. Make sure you don’t add any duplicate dependencies during this step.

If you’re using other package managers such as Bower, you’ll need to take an intermediary step of moving your dependencies from there to NPM. For Bower, [migration information is available](https://bower.io/blog/2017/how-to-migrate-away-from-bower/).

### Code

If your code is all in a single app, you can copy it into the application’s folder. Configuration files go in the root of your application, and application code goes into the `src/app` folder. Assets such as images, icons, and fonts can go into the `src/assets` directory. An `index.html` is provided for you in `src`. You should add anything else you may need such as external fonts or icons from a CDN. `src/main.ts` will bootstrap your application. You may need to modify this file or modify your application file names to bootstrap your app.

## Running tasks

Now that your code is present, it’s time to tackle building and testing it.

### Local build and serve

Each generated application has a build process defined by Nx. This uses the Angular CLI for Angular, and webpack is used for all other projects. See if this build process works out of the box for you by running

```bash
nx serve my-application
```

If this doesn’t work for you, you may need to add or modify some configuration on the `build` task in your workspace configuration file.

[Learn more about local serving](/cli/serve)

### Unit tests

Each application will have a unit test process defined by your choices (Jest or Karma) during the creation of the application. To run tests for your application:

```bash
nx test my-application
```

It is recommended that unit tests live next to the code they exercise and code scaffolded by Nx will follow this pattern. If your unit tests currently live in a separate directory, you may need to modify your test configuration or move your test files.

Testing configuration files can be found in the root of your application as well as the workspace configuration file.

[Learn more about unit testing](/cli/test)

### End to End Tests

Each application will have an e2e configuration created as a separate application, appended with `-e2e`. In our example, you’ll see `my-application-e2e`. This `e2e` task uses the test runner you chose during generation, Protractor or Cypress. Your application’s e2e tests should be migrated to this directory. There will be an e2e test scaffolded for you to make sure everything works before you start adding your own. To run the e2e tests:

```bash
nx e2e my-application-e2e
```

All of the configuration for your e2e tests should be in this directory.

[Learn more about end-to-end testing](/cli/e2e)

### Linting

Nx uses ESLint for linting. Nx also has its own lint process to make sure your Nx configuration is valid.

To run the `lint` task for your workspace

```bash
nx lint
```

To run the `lint` task for a particular application:

```bash
nx lint my-application
```

Global configuration files for linting will be at the root of your workspace. Each application and library will extend those configuration files. Global configuration changes should be made in the root, while application-or-library-specific changes should occur in the application or library configuration files.

[Learn more about linting](/cli/lint)

### Formatting

Nx uses Prettier to ensure standard formatting across your codebase. Prettier configuration files are located in the root of the workspace. To format your workspace run:

```bash
nx format:write
```

[Learn more about formatting](/cli/format-write)

### Adding tasks

Nx offers built-in tasks for the most common needs: `serve`, `build`, `test`, `e2e`, and `lint`. You likely have additional tasks that are needed to manage or deploy your codebase. These tasks might include deployment, i18n workflows, or uploading assets to CDNs. These tasks can be set up as scripts that you run manually with node, ts-node, or npm scripts. You can migrate those tasks over as-is, to begin with.

You should consider implementing them as Nx tasks which should be a quick transition with the `run-commands` builder. [The `run-commands` builder](/executors/run-commands-builder) will allow you to run any custom commands you need as an Nx task. By implementing these commands in an Nx task, they are able to take advantage of the project graph in Nx and only run when necessary. They are also able to be cached and only be re-run when necessary.

Your use-case may also be covered by one of our community plugins. Plugin authors are able to extend the functionality of Nx through our plugin API.

[Learn more about the `run-commands` builder](/packages/nx/executors/run-commands)

[Learn more about caching](/using-nx/caching)

[Learn more about community plugins](/community)

## Migrating libraries

If your code is divided into libraries, you should also generate libraries for your code to migrate into:

For Angular libraries:

```bash
nx generate @nrwl/angular:library
```

For React libraries:

```bash
nx generate @nrwl/react:library
```

It’s important to remember: don’t just drop your code anywhere! Always generate an app or a library for that code before migration. Without the project configuration, you’ll miss out on key functionalities of Nx provided by the project graph generation and affected code detection.

### Establishing code boundaries

If you’re consolidating multiple repositories or libraries into a single Nx workspace, you may have concerns about code boundaries. Previously, you may have had well-established boundaries by separating code into different repositories or having a public API for a library. Nx features a tagging system that allows you to enforce these code boundaries in a granular way. Each project can be tagged, and you can constrain dependencies based on these tags.

[Learn more about tags and dependency constraints](/structure/monorepo-tags)
