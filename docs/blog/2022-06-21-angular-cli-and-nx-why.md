---
title: 'Angular CLI and Nx — Why?'
slug: 'angular-cli-and-nx-why'
authors: ['Colum Ferry']
cover_image: '/blog/images/2022-06-21/1*m7SsA6SRSlnC_o7YnehmUA.png'
tags: [nx]
---

In this blog post, I’ll present a comparison of both the Angular CLI and the Nx CLI and present some evaluations on the current state of each.

## What is Nx?

One of the more powerful additions to Angular 2+ was when the [Angular CLI](https://angular.io/cli) was introduced. This dramatically lowered the entry barrier for newcomers, allowing them to focus on learning Angular instead of having to deal with the underlying tooling setup. Also, features like code generation as well as automated code migrations (ng update) help during the development and the maintenance of the project.

When [Nrwl](https://nrw.io) founders Jeff Cross and Victor Savkin left the Angular Team at Google they saw the huge potential of such developer tooling, but with the aim to improve it with a particular focus on the needs of the community and companies outside of Google. Nx was heavily inspired by the Angular CLI and is now years later a fully standalone, widely adopted, and quickly growing build system with more than [**2 million downloads per week**](/blog/nx-the-fastest-growing-monorepo-solution-in-the-js-ecosystem). The Nx core team closely collaborates with the Angular team as well as with other teams on Jest, Cypress, Storybook, ESLint, and more, effectively serving as an integrative part with a mission to deliver the best possible integration between the various tools.

When Angular CLI users try out Nx they immediately feel at home due to the familiarity of the commands, but also get to experience the increased power and particularly the focus on modern community tooling. Let’s explore more.

## The Current State of Affairs

### Angular CLI

In recent releases, the Angular CLI kept reducing its feature set, mainly due to tools such as [Protractor](https://www.protractortest.org/#/) as well as [TSLint](https://palantir.github.io/tslint/) being deprecated. As a result, starting with Angular 14, the Angular CLI provides the following when generating a new application:

- Angular application
- Unit testing solution with Karma
- _(note, linting doesn’t come out of the box, however, when trying to run the lint command it can be set up automatically for you)_

### Nx CLI

Nx, on the other hand, generates an Angular workspace with the following setup:

- Angular Application
- Jest for Unit Testing
- Cypress for E2E Testing
- ESLint for Linting
- Prettier for improving code style consistency and readability

But it offers even more tooling integrations via generators:

- Storybook
- NgRx
- Tailwind
- Micro Frontend Support
- Module Federation Support
- Standalone Component-based Applications and Libraries

## Command Comparison

Everything you’re used to running with the Angular CLI will still work in the Nx CLI.  
As a quick reference, here is a list of commands provided by the Angular CLI and their counterparts in the Nx CLI.

## Feature Comparison

The Nx CLI can do everything the Angular CLI can do, and more. Let’s take a look at a more comprehensive feature comparison between the two CLIs.

_\* It’s worth noting that if you run_ `_ng lint_` _in a new project, the command will ask if you want to install ESLint. You can then lint your project. However, it does not have a linting setup provided out of the box._

## Code Generation

Both CLIs offer built-in code schematics/generators to help scaffold code quickly. However, Nx provides all the schematics that Angular provides as well as additional generators to help improve your developer experience even further. Nx has generators to integrate tools such as

- Tailwind — `nx g setup-tailwind <projectName>`
- Storybook — `nx g storybook-configuration <projectName>`
- NgRx — `nx g ngrx <storeName> --project=<projectName>`

As well as generators to help you scaffold out

- Micro Frontends — `nx g host shell & nx g remote remoteApp`
- Single Component Angular Modules (SCAMs) — `nx g scam myscam`
- Standalone Component-based applications — `nx g app --standalone`
- Standalone Component-based libraries — `nx g library --standalone`
- Web Workers — `nx g web-worker <workerName> --project=<projectName>`

## Caching

Angular’s caching solution is built on top of Webpack’s incremental build cache. This helps speed up rebuilds as the cache is persisted onto disk. Nx doesn’t change that. It leverages Angular’s builder but in addition, also adds [Nx’s own computation cache on top](/concepts/how-caching-works).

See the graphic below where we compare the result of getting a cache hit on the Angular CLI with the result of getting a cache hit on the Nx CLI.

![](/blog/images/2022-06-21/0*FHeE4wexoYQw3RT9.avif)

The initial Webpack build with Angular CLI takes ~12s, the following cache hit build takes ~4s.  
The initial Webpack build with Nx CLI takes ~10s, the following cache hit build takes ~14ms.

Being tied to Webpack, Angular’s cache is just local to your workstation and only for builds. Nx instead is able to cache any custom operation you specify, including your builds, lint, and tests. In addition, you have the ability to split your project into smaller consumable units, that can also be tested and linted. This means we can take advantage of parallelization to run tests and lints in parallel and take better advantage of the cache of any projects that have not changed! All of this results in faster CI times and a better local developer experience.

By integrating with [Nx Cloud](/nx-cloud) you also get the opportunity to

- [distribute the cache remotely](/ci/features/remote-cache) such that other co-workers, as well as your CI system, can leverage it to speed up operations
- [automatically distribute your task execution](/ci/features/distribute-task-execution) across multiple agents on CI

## Migrations

Angular has always been committed to ensuring evergreen development. It introduced the concept of automatically upgrading your workspace and running code migrations to reduce the chance of running into breaking changes between versions. This can be done using the `ng update` command. Once the command is run, Angular will install the new versions of packages and run any code migrations that will be required.

Nx is also committed to providing the same experience, however, it is a little bit more nuanced about it. The `nx migrate` command should be used in two steps. The first run of `nx migrate` will update the dependencies versions in the `package.json` file and also generate a file named `migrations.json`. However, it will not automatically install the new packages or run the code migrations. You can do this by running `nx migrate --run-migrations`.

The reason behind this comes from what we have learned from working with large multi-team organizations. Some automatic code migrations will generate a lot of changes and this can become difficult to review in a subsequent PR. It can be even more difficult for reviewers if there are multiple different code migrations within a single PR.

By creating a `migrations.json` file that contains each of the migrations to be run, we can be more selective with the migrations we run, meaning we can create multiple PRs to focus on each migration, allowing for incremental updates and the ability to re-run migrations.

This can also be helpful when we have teams that have long-lived feature branches and we need to reduce the impact of changes and risk of merge conflicts. It also allows these teams to re-run migrations on their own branches.

You can read more about our approach to [updating and migrations here](/features/automate-updating-dependencies) or watch this [Egghead video on leveraging Nx migrations](https://egghead.io/lessons/javascript-update-your-nx-workspace-with-nx-migrations).

## Configuration

The Angular CLI and Nx CLI use a very similar approach to configuration to manage your projects and workspaces.

The Angular CLI uses a root `angular.json` file that contains the configuration of all projects in the workspace. This configuration is used to dictate how the project should be built and tested. Other tools may also configure how they should work within this configuration file.

The Nx CLI will place an `angular.json` configuration file at the root of your workspace which points to individual `project.json` files for each of the projects in your workspace. Each of these `project.json` files follow a similar structure to projects within Angular’s `angular.json`, except scoped to just one project.

This configuration splitting is extremely useful as it allows configuration to live beside the project it targets, making it much easier to find and reason about, as well as preventing large git merge conflicts when multiple teams have added new projects in their feature branches.

There is a very slight naming difference between some of the properties in both configuration files. You can see a mapping of those in the table below.

Despite that, Nx contains a compatibility layer between itself and the Angular Devkit, allowing for Angular CLI configuration and Angular Schematics to work correctly, even when used in an Nx Workspace!

## Architecture

A typical Angular Workspace consists of an application at the root of the workspace and then allows for the development of additional applications and libraries under a folder named projects.  
While this can allow for the splitting of large applications into smaller manageable chunks, the tooling to manage this architecture is not provided by the Angular CLI.

Nx, on the other hand, embraces this separation of applications and libraries, encouraging the concept that an application is a composition of small, focused chunks (or libraries). This lends itself well to a Domain-driven architecture. Breaking down our applications into these smaller, domain-focused libraries, not only helps with the overall architecture and maintainability of the application but allows Nx at the same time to increase the number of cacheable units within your workspace to dramatically reduce testing and lint times.

In addition, Nx comes with tooling such as custom lint rules which can also enforce some rules around what libraries can be used by other libraries and applications. You can read more about that [here](/blog/mastering-the-project-boundaries-in-nx).

## Extensibility

The Angular CLI can be extended with schematics and builders that aim to allow library authors to provide opinionated code generation and different approaches to executing code in the workspace. An example of this would be `ngx-build-plus` which allows for an additional Webpack configuration to be taken into account when building the Angular application. However, the Angular CLI isn’t fully pluggable and the Angular Devkit, which utilizes RxJS, can be difficult to approach if you ever do find the need to offer schematics as part of your package.

The Nx CLI is fully pluggable and embraces the idea of Nx Plugins that can be used to enhance your development experience. Nx offers some official plugins, but it also has a large listing of community plugins ([/community](/community)) that aim to provide support for many tools and integrations!

Nx Plugins can be built with the Nx Devkit, which uses Async Generators and provides many helper functions to make it super easy to build your own code generators and code executors.

Nx even understands the concept of local plugins, which allows you to build a plugin in the same workspace as your application. This provides the opportunity to create opinionated code generators for your full organization to maintain consistency in development practices across all teams working on the application.

You can read more about the Nx Devkit here: [/nx-api/angular/documents/nx-devkit-angular-devkit](/nx-api/angular/documents/nx-devkit-angular-devkit)

## Switching from the Angular CLI to the Nx CLI

Have you been convinced to try out the Nx CLI but already have an Angular application using the Angular CLI? Don’t worry! The Nx CLI offers a single command that will automatically migrate _most_ Angular workspaces to use Nx. It has been recently refactored to support multi-project workspaces as well as some known standard deviations from Angular’s opinionated workspace scaffolding.

You can use the command below in your Angular Workspace to kick off the migration.

```shell
npx nx init
```

Note: You need to ensure you use the correct command based on the version of Angular your workspace is using. The easiest way would be to ensure your Angular workspace is at the latest Angular version and then run the command!

Otherwise, you can read more about migrating to Nx here, including the command to run based on your version of Angular: [/recipes/angular/migration/angular](/recipes/angular/migration/angular)

## Conclusion

Looking objectively across everything discussed within this post, it becomes clear that the Nx CLI offers everything that the Angular CLI does and then some. From more out-of-the-box tooling support to faster builds and more features, the Nx CLI dramatically improves your Angular development experience, while allowing you to reuse most of the knowledge you have gained from using the Angular CLI. And the large ecosystem of Nx Plugins means you can take advantage of all the features of Nx for more than just Angular applications if you need to!
