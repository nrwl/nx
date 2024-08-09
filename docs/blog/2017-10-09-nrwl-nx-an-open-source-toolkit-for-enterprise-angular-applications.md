---
title: 'Nrwl Nx — An open source toolkit for enterprise Angular applications.'
slug: 'nrwl-nx-an-open-source-toolkit-for-enterprise-angular-applications'
authors: ['Victor Savkin']
cover_image: '/blog/images/2017-10-09/0*44TVT2Pa3jrEkaXJ.png'
tags: [nx, release]
---

Nx is designed to help you create and build enterprise grade Angular applications. It provides an opinionated approach to application project structure and patterns.

## Why Nx?

At Nrwl we help the Fortune 500 build Angular applications.

- **These companies don’t build small apps.** They have multiple teams building multiple apps using multiple shared libs. It’s many to many to many. Organizing this dev workflow is challenging.
- **They care about consistency.** If every team uses their own unique way of building software, the code is harder to reuse and integrate.
- **They have legacy AngularJS apps they need to upgrade.** NgUpgrade is great, but it is easy to misconfigure.
- **They want to write robust, proven code**: error handling, race conditions, etc.

To address these we developed a set recommendations for our clients. Some of them are based on our experience on the Angular team at Google, others are based on our experience in the industry in general. After implementing them over and over again, we saw that many can be automated, and that’s what Nx is.

Nx is a set of Angular CLI generators, linters, and runtime libraries eliminating a lot of the speed bumps teams face when building **ambitious** Angular applications.

## Design Principles

At Nrwl we strongly believe that any software has to adhere to a small core of values and design principles. These are the values and the design principles of Nx.

### Values

- **Productivity** Nx should help you develop new features and refactor with ease, even when the code base grows in size.
- **Consistency**: Nx should help you separate what is unique to your application from what is not, and only spend time on the former. The Angular CLI has great starting conventions, which we take further by focusing only on one subset of Angular apps: complex enterprise applications.
- **Safety**: Nx should help you avoid costly mistakes.

### Our Design Principle

Your tech stack is already complex (rxjs, angular, typescript, webpack, …). There is a lot to master. We don’t want to make it even more complex — we want to provide a lot of value with as few lines of code as possible.

For instance, every single application we look at has a lot of race conditions. After helping client after client to fix them, we asked ourselves: “Can we build a small tool to get rid of them?”. We built a 50-line service that integrates with NgRx effects and gets rid of a lot of race conditions seen in a typical web application. It’s so small that you can read through it and understand what it does in minutes.

This is the design principle of Nx: **everything should be dead simple to understand.**

We learned about what Nx solves, now let’s look at how it does it.

## Nx Workspace

An Nx Workspace is one of the most interesting parts of Nx, and also one of the simplest parts. It makes so many things so much easier, that it can have a transformative effect on your team and even your organization.

What is it?

**It is a “mono repo” way of building frontend applications.** As I said before, working with multiple applications and libraries is difficult. From Google to Facebook, Uber, Twitter and more, a good amount of large software companies handle this challenge by taking a mono repo approach. And they have been doing so for years. These are some of the advantages this approach provides:

- Everything at that current commit works together
- Easy to split code into lib modules, easy to compose them.
- Easier dependency management
- One build setup (AngularCLI)
- Code editors and IDEs are “workspace” aware.
- Consistent developer experience

What’s important, an **Nx Workspace is built on top of the Angular CLI.** This is key! We want to make your team more productive. We also want you to use the CLI, so the WebStorm and VSCode integrations keep working. Thankfully, the Angular CLI 1.5 has an extensibility mechanism we are taking advantage of. Hans Larsen and Mike Brocchi, from the Angular CLI team, helped us to fix issues and make “Nx Workspace” a smooth Angular CLI experience.

Watch the video above to see it in action.

Whereas in the standard CLI or WebPack setups, it may take you hours to create a new library, with an Nx Workspace you can do it in seconds. Because it is so easy and so quick, you are more likely to do it. **Instead of having a large monolith, you will have dozens of small libraries with well-defined public APIs** (and an Nx Workspace ensures you only use your libraries’ public APIs).

**You can develop and test these libraries independently.** If at one point you want to extract a library into a separate repository, you can do it in minutes. The other libraries or applications in the workspace won’t be affected. Similarly, if you want to build a new application, say targeting another platform, you can do it in minutes by just composing existing libraries.

The ease with which we can do all of these will significantly improve your teams’ velocity and your projects’ code quality.

### Convert to Workspace

Since most of you already have existing CLI projects, we built a generator to convert them into an Nx Workspace.

## State Management

**Managing state and side effects is probably the hardest problem in frontend development.**

NgRx is the de facto state-management library used in the Angular community. It gives you a lot of freedom, but it means that it leaves a lot up to you to figure out. As a result, teams spend time debating how it should be used, and different teams come up with their own incompatible solutions. Not only is it an inefficient use of developer time, it also inhibits teams’ abilities to share knowledge and tools.

We love NgRx (I \[Victor Savkin\] am on the NgRx team and contribute to its router integration). To help teams use this library more effectively we came up with a convention that works well for most teams. **Just run _ng generate ngrx_, and you will get your state management in place, with tests, dev tools, and everything else set up.**

Watch the video above to see it in an action.

Again, it’s a simple solution that provides a lot of value:

- Gives you reasonable, lazy-loading-friendly conventions.
- Wires up redux dev tools for the development environment.
- Wires up marble testing for effects (and we ship a few helpers to make such testing easier).
- Sets up the DataPersistence service that mitigates the main source of Effect race conditions.

## And a lot more…

There are many more things Nx helps with. One of them, for instance, is upgrading existing AngularJS apps. Nx gives you a command to set up a hybrid app in seconds.

[See documentation to learn more.](http://nrwl.io/nx)

## Give It a Try

We hope you are excited about Nx, and you are eager to try it out. Even if you work on a small team, building one application, we believe you will still find valuable.

Go to [nrwl.io/nx](https://nrwl.io/nx) to get started!

## Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2017-10-09/0*aUigQEx76e90A7Y7.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
