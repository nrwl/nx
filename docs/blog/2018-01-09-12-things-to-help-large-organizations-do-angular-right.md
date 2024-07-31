---
title: '12 Things to Help Large Organizations Do Angular Right'
slug: '12-things-to-help-large-organizations-do-angular-right'
authors: ['Victor Savkin']
cover_image: '/blog/images/2018-01-09/1*mt1GWICoGwBsuRU78HMN0Q.png'
tags: [nx, release]
---

_Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools._

At Nrwl we help the Fortune 500 with using the Angular platform the **right** way. These companies don’t build small apps. They have multiple teams building multiple apps using multiple shared libs. Developers experience these scenarios know that it quickly becomes a many-to-many convolutional nightmare.

In this article I’ll talk about:

- why it is so hard for large companies to get it right
- why Angular is a great option for large companies
- how to do it

At the end of the article — after discussing after discussing some of the driving factors and concerns — I’ll include a checklist of **12 Things** architects at large organizations can do to make their teams more productive.

## Challenges of Large Organizations

On the surface, large and small organizations actually care about the same things:

- **They care about consistency.** If every team uses their own unique way of building software, the code is harder to reuse and integrate. Having a consistent setup helps developers focus on business-related problems instead of solving generic tech problems over and over again.
- **They need to write robust, proven code**: error handling, race conditions, etc.
- **They need to write maintainable, self-documenting code.**
- **They want to be able to make changes with confidence**. If developers can quickly verify that changes are safe to merge, they are more likely to keep the code base healthy.

What’s different about large organizations is that they have hundreds of Angular engineers building dozens of apps. So they have a lot of code, and this changes everything.

- While ten (10) developers can reach a consensus on best practices by chatting over lunch, five hundred (500) developers cannot. **You have to establish best practices, team standards, and use tools to promote them.**
- Code ownership concepts become very important as the code size and complexity scales. With three (3) projects, for example, developers will always know who is the best person to review a PR, with thirty (30) projects they won’t. **You have to explicitly define and automate the ownership model.**
- With three (3) projects, for example, developers will know what needs to be retested after making a change, with thirty (30) projects, however, this is no longer a simple process. Informal team rules to manage change will no longer work with large teams and multi-team, multi-project efforts.. **You have to rely on the automated CI process instead.**
- …

In other words, small organizations can often get by with informal ad-hoc processes, whereas large organizations cannot. Ad-hoc process also make onboard new developers much more difficult and error prone.

## Angular is a Good Framework for Large Organizations

Being one of the main contributors to Angular (2.x or higher), it is not surprising that I think Angular is a great choice for companies of all sizes, big or small. But let me highlight a few reasons why the framework is especially well-suited for large organizations.

## No Fragmentation

The Angular community is not fragmented. Almost all applications are built using the Angular CLI, use the Angular router, and many use NgRx (or plan to use it) to manage state and side effects. **This uniformity leads to greater consistency**. So when a new developer joins a team, she can become productive in days. She can also move within an organization while remaining productive.

## Semantic Versioning

A new version of Angular is released every six months. If a breaking change is about to be introduced, you will have a year to update your applications. This makes my life as a contributor to the framework harder (e.g., I cannot fix the mistakes in the router design), but makes my life as someone who helps companies be successful with Angular much easier.

## Angular 💗 TypeScript

TypeScript is one of the best things that happened to the JS ecosystem. It provides developers with development-time warnings and errors. It also articulates intention and removes ambiguity (read more [here](https://vsavkin.com/writing-angular-2-in-typescript-1fa77c78d8e8)). Angular is not the only framework that works well with TypeScript — most modern frameworks do. **But it is the only mainstream framework where the whole ecosystem works well with TypeScript**: every single tool and every single library. As a result, typings are never out of date, APIs feel nice and ergonomic when used with types, source code manipulation tools use the TypeScript compiler API under the hood.

> TypeScript as a uniform language makes a big difference.

## Automation

Large organization rely on tools and automation. Often this means that the source code has to be statically analyzable. And Angular is built with this in mind. It clearly separates the static and the dynamic parts of your application, which enables you to write reliable tools manipulating Angular source code. In addition, tools can build, test, run, and package Angular applications without having the developers to configure anything.

## How to Do It

The four (4) main areas that can have the biggest impact on your organization are:

1.  source code management,
2.  dependency management,
3.  promoting best practices, and
4.  automation.

Let’s examine them in detail.

## Source Code/Dependency Management

As I mentioned above, large organizations have a lot of source code and a lot of people make changes to source, packages, deployment, etc.. So figuring out how to store it, how to effectively make changes to it, how to set up dependencies between different projects, how to build and release them are the questions you need to answer early on. Once you start examining these questions, you will see that not all projects/modules are alike.

In a typical setup, there are four categories of projects/modules:

1.  **Apps**. These are your products, something you ship to the user.
2.  **2\. App-specific libs.** These are apps’ sections that can be developed and tested independently.
3.  **Reusable libs.** These are your components, services, utilities used in many different apps.
4.  **Third-party libs and tools.**

![](/blog/images/2018-01-09/1*OVT_qkg4oCsYvDWPJVuVXQ.avif)

To be effective, developers should be able to:

- Create app-specific libs
- Extract reusable libs
- Verify that a code change to a reusable lib does not break any apps and libs that depend on it
- Refactor multiple apps and libs together
- Determine who is responsible for a particular app or lib

The ease with which developers can do all of these has a big impact on your teams’ velocity and your projects’ code quality.

If it takes a day to create a new reusable library (create a repo, set up CI, publish it to a local npm registry), few will do it. As a result, developers will either duplicate the code or put it in a place where it does not belong. When it is easy to scaffold and configure a reusable library within minutes (instead of days)… only then will developers invest in building and maintaining reusable libraries.

If multiple applications have dependencies on multiple libraries, regression testing can become very difficult when a library changes. If it is impossible to automatically verify that a change to a reusable library does not break any apps depending on it, developers will be afraid to make changes and will write defensive, brittle code.

> If developers cannot refactor across different apps and libs, they won’t evolve the APIs.

When developers cannot build and test apps’ sections independently, they will create monolithic applications with tightly coupled modules. When they can (using app-specific libs), they will produce more maintainable code and will improve their applications’ architecture.

This is mainly because they have to explicitly define what a feature depends on and what it exports, they have to think it through. The result is similar to the [hexagonal architecture](http://alistair.cockburn.us/Hexagonal+architecture), which reduces coupling between projects.

### Nx — Smart, Fast and Extensible Build System

![](/blog/images/2018-01-09/1*H2zgVGgEhBCNadIZindBtg.avif)

Nx is an open source, smart, fast and extensible build system that comes with first class support for Angular, React, Node and more. It uses the monorepo approach, where many applications and libraries are stored in the same source code repository (read more about it [here](https://nrwl.io/nx/why-a-workspace))

With Nrwl/Nx developers can:

- Create app-specific libs in minutes
- Extract reusable libs in minutes
- Verify that a code change to a reusable lib does not break any apps and libs depending on it (Nx comes with the commands to rebuild and retest only the apps affected by a PR)
- Refactor multiple apps and libs together

Nx also forces you to use a single version of every third-party library (even though it’s possible to work around it when needed ). This is important. If your applications and libraries depend on different versions of, say, TypeScript, they may not be reusable. Using different combinations of libraries can result in hard-to-debug issues. Even if you don’t use Nx, I recommend to create a package called _third-party_, list major third-party dependencies there, and make other apps and libs depend on it.

Nx does not take care of code ownership because it is dependent on how your source code is stored. If you use github, you can take advantage of the [CODEOWNERS file](https://github.com/blog/2392-introducing-code-owners).

Whether you choose to use Nx or not, make sure you explicitly define the workflows for the five operations above, document them, and measure how quickly developers can do them.

## Promoting Best Practices and Automation

Code reviews and the word-of-mouth are great ways to promote best practices in small organizations. The larger the organization gets, however, the more resource intensive, error prone, and inconsistent this process becomes. Use tools to remedy this problem.

### Create Small Reusable Libraries

Often the simplest thing can have the biggest impact.

Take, for instance, creating small reusable libraries. Even by extracting only 30 lines of code into a reusable library, you can make your teams much more productive and save many weeks of work.

For instance, every single application the team at Nrwl looks at has a lot of race conditions. Some of these are obvious and some are very subtle and hard to track origination. Even the most seasoned, senior Angular developers overlook subtle race conditions.

After helping many clients resolve these types of issues, we were forced to ask ourselves: “Can we build a small tool to eliminate (or avoid) code manifesting race-conditions?”.

As a result, we implemented a 50-line service that integrates with NgRx Effects and eliminates many of the race conditions seen in Web applications. This critical feature is so small that you can read through it and understand what it does in minutes. We made it part of Nx. Encourage your developers to do the same. You can start by focusing on the three areas that tend to cause the most problems: testing, state management, and routing.

### Create Schematics for Code Generation

Angular CLI uses the schematics library for code generation. Nrwl/Nx is built on top of the Angular CLI, and it passes a custom collection of schematics tailoring the CLI experience for the multi-app/multi-lib setup. Enterprise teamsshould take it one step further and create a collection of schematics used in your organization. For instance, if you use mock data in your integration tests, create a schematic to generate the fixture.

Measure how long it takes for a developer to implement a simple source code generator. Only when it takes minutes, folks will do it.

### Create Custom Lint Checks

TSLint is good at two things: making sure developers do not make costly mistakes, and making the source code more consistent. TSLint can be run on the CI, and also integrates well with all major editors and IDEs.

Embrace this tool. Set it up and document the process of creating a new TS lint check, so your developers can do it in minutes.

### Automate Everything (Use Formatters)

It’s surprising how few organizations set up things like automatic code formatting. Largely, it is because many believe it is not the most important thing to focus on. And I would agree if it took weeks to get it right. But, in reality, it often takes 30 minutes, and it has a surprisingly large effect: it makes the source code more consistent, and it eliminates a whole class of problems.

The biggest benefit with formatters and team usage is commits and code reviews. Then only the actual changes show as deltas, instead of myriad formatting changes obfuscating a few critical code changes

> Nrwl Nx comes with a few command to set up automatic code formatting locally and in the CI.

## TLDR/Architect Checklist

This is a list of things (a checklist) architects at large organizations can do to make their teams more productive.

1.  Define **the set of tools you will use use to build Angular apps (CLI, Nx, NgRx)**. Developers like to build custom tools, but using standard tools is almost always a better option, at least in the long run. Create an exemplary repo built with the tools.
2.  Define **a process for creating/extracting a new library**. Measure how long it takes.
3.  Define **a process for verifying that a code change to a reusable lib does not break any apps and libs that depend on it**. Treat the dev machine and the CI experiences separately. Measure how long it takes.
4.  Define **a process for refactoring multiple apps and libs**.
5.  Define **a process for assigning and checking ownership**. Without a good ownership model in place a chaos will ensue.
6.  Define **a source control management strategy**: trunk-based development or feature-based development. Try to make it the same for all apps and libs.
7.  Define **an explicit policy of managing third-party dependencies**.
8.  Define **state management and side effect management best practices**. Automate as much as possible.
9.  Define **testing best practices**. Automate as much as possible.
10. Create **an organization-specific tslint package** from the get go. It’s a great way to promote best practices.
11. Create **an organization-specific schematics package** from the get go. It’s a great way to promote best practices.
12. Automate everything that can be automated (e.g., **set up automatic formatting**).

Unsurprisingly Nrwl Nx helps with a lot of these. After all, that’s why we created it. But as with most things, it is not about using a particular tool, but about choosing tools and processes carefully.

## Learn More

- [Check out the free video course on Nrwl Nx](https://angularplaybook.com/p/nx-workspaces)
- [Angular: Why Typescript](https://vsavkin.com/writing-angular-2-in-typescript-1fa77c78d8e8)

### Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2018-01-09/0*NSLFXiKLN4PAjCOW.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
