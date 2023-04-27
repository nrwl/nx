# Glossary

This is a short list of Nx-specific terms that will help you understand the rest of the documentation.

## Terms

### Application

A [project](#project) that can run on its own. Generally uses [libraries](#library).

> See: [Applications and Libraries](/more-concepts/applications-and-libraries)

### Buildable Library

A [library](#library) that has a `build` [target](#target). Some libraries can be generated with a `build` target using the `--buildable` flag.

> See: [Publishable and Buildable Nx Libraries](/more-concepts/buildable-and-publishable-libraries)

### Cache

A mechanism for saving the output of a calculation so it can be replayed later without actually performing the calculation again.

> See: [Cache Task Results](/core-features/cache-task-results)

### Cache Hit

When the [cache inputs](#cache-inputs) for a [task](#task) match an existing entry in the [cache](#cache) and the [cache outputs](#cache-outputs) can be replayed without actually running the task.

> See: [Cache Task Results](/core-features/cache-task-results)

### Cache Inputs

Everything that might change the output of a [task](#task). This may include source code, task options, environment variables and other settings determined at run time. These values are combined as a hash to serve as a key for an entry in the [cache](#cache).

> See: [Customizing Inputs and Named Inputs](/more-concepts/customizing-inputs)

### Cache Miss

When the [cache inputs](#cache-inputs) for a [task](#task) do not match an existing entry in the [cache](#cache) and the task needs to be executed.

> See: [Cache Task Results](/core-features/cache-task-results)

### Cache Outputs

The terminal output and any file artifacts created by running a [task](#task). These values are stored in the [cache](#cache) to be replayed later.

> See: [Outputs Reference](/reference/project-configuration#outputs)

### Command

Anything you run in the terminal. An example commmand that invokes a [task](#task) is `nx build my-app`.

> See: [Run Tasks](/core-features/run-tasks)

### Configurations

A set of preconfigured options for a [target](#target) that should be enabled all together. For example, a `production` configuration would set all the options needed for a build that could be deployed to production.

> See: [Use Executor Configurations](/recipes/executors/use-executor-configurations)

### Distributed Cache

A [cache](#cache) that can be shared between all developers using the repo and the CI system.

> See: [Share Your Cache](/core-features/share-your-cache)

### Distributed Task Execution

A system for running [tasks](#task) in CI across multiple agent processes in the most efficient way possible.

> See: [Distribute Task Execution](/core-features/distribute-task-execution)

### Executor

A script that performs some action on your code. This can include building, linting, testing, serving and many other actions. A [target](#target) configuration specifies an executor and a set of options. Executors can be found in [plugins](#plugin).

> See: [Use Task Executors](/plugin-features/use-task-executors)

### Generator

A script that creates or modifies your code. Generators can be found in [plugins](#plugin).

> See: [Use Code Generators](/plugin-features/use-code-generators)

### Graph

A computer science concept that consists of nodes connected by edges. In the Nx context, there are two graphs: the [project](#project) graph which describes dependencies between projects and the [task](#task) graph which describes dependencies between tasks.

> See: [Explore the Graph](/core-features/explore-graph)

### Integrated Repository

A repository using Nx [plugins](#plugin) to boost efficiency and ease of maintenance.

> See: [Integrated Repos vs. Package-Based Repos](/concepts/integrated-vs-package-based)

### Library

A [project](#project) that is used by [applications](#application) or other [libraries](#library).

> See: [Applications and Libraries](/more-concepts/applications-and-libraries)

### Monolith

A large [application](#application) that is difficult to separate into smaller pieces.

> See: [Applications and Libraries](/more-concepts/applications-and-libraries)

### Monorepo

A repository with multiple [projects](#project).

> See: [monorepo.tools](https://monorepo.tools)

### Nested Project

A [project](#project) that is located in a sub-folder of another project. This was made possible in Nx 15.3.

### Nx Cloud

A service that provides [distributed caching](#distributed-cache) and [distributed task execution](#distributed-task-execution).

> See: [What is Nx Cloud?](/nx-cloud/intro/what-is-nx-cloud)

### Package

A [project](#project). It is sometimes published as an npm package.

### Package-based Repository

A repository using Nx without [plugins](#plugin) that prioritizes the independence of the separate [packages](#package). Nx is added to the repo without significantly affecting the file structure or build settings.

> See: [Integrated Repos vs. Package-Based Repos](/concepts/integrated-vs-package-based)

### Plugin

A set of [executors](#executor), [generators](#generator) and other code that extends the functionality of Nx. May be installed from a package manager like NPM or developed directly in the repository.

> See: [Create Your Own Plugin](/plugins/intro/getting-started)

### Polyrepo

Related [projects](#project) spread across multiple repositories.

### Project

The unit of code on which a [task](#task) can be run. A project can be an [application](#application) or a [library](#library).

> See: [Applications and Libraries](/more-concepts/applications-and-libraries)

### Publishable Library

A [library](#library) that has a `publish` [target](#target). Some libraries can be generated with a `publish` target using the `--publishable` flag.

> See: [Publishable and Buildable Nx Libraries](/more-concepts/buildable-and-publishable-libraries)

### Root-Level Project

A [project](#project) that has its own root folder at the root of the repository. Every other project in the repo is a [nested project](#nested-project).

### Standalone Repository

A repository with a single [application](#application) at the [root level](#root-level-project). This set up is made possible in Nx 15.3.

### Target

The name of an action taken on a [project](#project).

> See: [Run Tasks](/core-features/run-tasks)

### Task

An invocation of a [target](#target) on a specific [project](#project).

> See: [Run Tasks](/core-features/run-tasks)

### Task Pipeline

The set of dependencies between [tasks](#task) that ensure that tasks are run in the correct order.

> See: [Task Pipeline Configuration](/concepts/task-pipeline-configuration)

### Workspace

A git repository. An Nx workspace is a git repository using Nx.
