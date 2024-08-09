---
title: 'Why you should switch from Lerna to Nx'
slug: 'why-you-should-switch-from-lerna-to-nx'
authors: ['Victor Savkin']
cover_image: '/blog/images/2019-09-03/0*fFokkplT3K7FCCKg.png'
tags: [nx, release]
---

**UPDATED VERSION OF THIS POST (+ VIDEO) CAN BE FOUND** [**HERE**](https://medium.com/lerna-yarn-nx-faster-build-times-better-dev-ergonomics-2ec28463d3a5?sk=fbaf8243c6bdbc7fad61a47f899eedfd)**.**

In the last couple of years Babel, Angular, React, Jest and many other open source projects switched to using monorepos. Many of them use Lerna to organize their repositories.

Monorepos aren’t only useful for open source projects. They are an even better fit for organizations developing real applications. Google, Facebook, Uber, Twitter all do it, and they use custom dev tools that provide more capabilities than Lerna. These tools are built for specific companies, so they are hard to set up and adopt.

Nx is a set of extensible dev tools for monorepos. We built Nx based on our experience of working at Google and helping companies adopt this way of developing apps. I like to think of it as the Webpack of monorepo tools. Similar to how Webpack did what other bundlers like Closure had done before, just in an easy to use way, Nx is an easy to use version of the powerful monorepo tools used at companies like Google.

To see **when** you should use Nx instead of Lerna, let’s look at how organizations buildings applications are different from open source projects.

## Applications vs Open Source Projects

**What is different about building applications in a monorepo compared to building open source projects?**

### Nature of Packages

Most libraries developed in open source projects are published to npm. Every library is public — you cannot prevent people from depending on it. You also don’t know every single user of your library, so you cannot make sure they are all up to date or that they use your library correctly.

Organizations focus on developing applications, not libraries. They create libraries, but mainly to partition applications into maintainable units or to share code. Most of these libraries are consumed by other libraries and applications in the same organization. So often you know every single user of your libraries and at least in theory can update them, so they are up to date. Not every library is public, some of them are private to your team. Finally, the bar for creating a new library is significantly lower: sharing a component between two applications built by one team does not require the same prep as creating a component used by tens of thousands of people you don’t know.

### Ownership

![](/blog/images/2019-09-03/0*ookln3GHKUMVIxEv.avif)

Open source projects are usually owned by a single team. The team can of course have different domain experts, but you still have the feeling of working on the whole repository together.

Most companies build more than one application. It’s often done by multiple teams, often from separate orgs, reporting to different people, and located all over the world. The applications can share code (that’s one of the main reasons to use a monorepo), but you have a clear understanding of what code belongs to you and what code doesn’t.

### Variability

![](/blog/images/2019-09-03/0*MK_Ls4nud_3bsBxk.avif)

An open source project is usually built for a single purpose by a single team. So the team can agree on what tools and technologies to use to implement the project.

This is not the case for organizations. Team A located in London and Team B located in Toronto may not talk to each other. They may come from different backgrounds and have different preferences. Team A may want to use React and Jest, whereas Team B may want to use Angular and Karma. Also, developing an application requires working with many more different types of packages: a library of interfaces, a collection of e2e tests, an api, a collection of styles, a storybook setup, documentation, etc..

### Scale

![](/blog/images/2019-09-03/0*NGXpSuixvi30qiIu.avif)

An open source project rarely contains more than a dozen packages. Even a mid-size org monorepo can contain hundreds or even thousands of packages. Managing code, enforcing best practices, managing dependencies, making CI fast are a lot harder at this scale.

## Two Use Cases

**A monorepo for an open source project consists of a dozen similar packages, built by a single team using similar tools.**

**A monorepo for an organization consists of hundreds of different types of packages, many of them are applications, built by multiple independent team using different tools.**

**Tools like Lerna are optimized for the former, tools like Nx for the latter.**

## How to Use Nx to Build Applications in a Monorepo

If you haven’t used Nx, you way want to watch this 10-minute video before reading the rest of the post:

## Creating Applications

Now, let’s create a new Nx workspace.

```shell
npx create-nx-workspace happyorg --preset=react-express --appName=tickets
```

The workspace has two applications `tickets` and `api`, a suite of e2e tests, and a library `api-interfaces`, which the applications share.

We can run the applications as follows:

- `nx serve api`
- `nx serve tickets`

If we change anything in `api-interfaces` both the api and the frontend will reflect the change.

The example shows that **Nx provides first class support not just for libraries (packages to be used in other packages), but also for applications.** We can build/serve/test them. Applications often work in tandem, and Nx helps coordinate that. Application can often run in different modes, and Nx provides a way to manage those (e.g., `nx serve tickets` and `nx serve tickets --configuration=production`).

## Creating Libraries

**Most libraries in an org monorepo are consumed by other libraries and applications in the same repo. This means they are lightweight, which in turn means we can create many more of them.**

Creating every single library from scratch is tedious and error prone. That’s why Nx has first-class plugins for a few major frameworks, so we can create plain ts/js libraries, angular libraries, react libraries with ease. This is how it is done:

```
nx g @nrwl/react:lib ticket-list
```

Right after we ran the command, we can import the newly created library into an application without any configuration:

**Having such generic capabilities is good, but not enough. Every organization has specific needs. With Nx, we can define our unique set of code generators we can use to promote best practices within our organization.**

## Enforcing Ownership

Let’s say we have a different team that added another application into the workspace.

```shell
yarn add @nrwl/angular
nx g @nrwl/angular:app agent
```

We need to make sure that the agent and tickets teams can develop their applications without stepping on each others toes.

Adding a [CODEOWNERS](https://help.github.com/en/articles/about-code-owners) file solves a part of the problem, so the folks from the agent team cannot change the tickets app without the tickets team knowing and vise versa. That’s good but not enough.

To see why, let’s imagine the `api-interfaces` library is owned by the tickets team, and they want to be able to change it freely. As it stands right now, nothing prevents the agent team from doing this:

This is a problem.

The CODEOWNERS file tells us who owns every node of the dependency graph, but it doesn’t tell us what edges are allowed. To solve this, Nx provide a generic mechanism for defining rules that specify how libraries can depend on each other. So the import above will result in this error message:

![](/blog/images/2019-09-03/0*aDJ0CvgVAjw59XYQ.avif)

Read more about it [here](https://nx.dev/react/guides/monorepo-tags).

## Building Only What is Affected

Rebuilding and retesting everything on every commit does not scale beyond a handful of projects.

Nx can figure out the dependency graph of the workspace by analyzing the code. It then can use the graph to only rebuild and retest what is affected.

For instance, if we change the `api-interfaces` library and run:

```
nx affected:dep-graph
```

We will see that Nx figured out that both `api` and `tickets` are affected by this change:

![](/blog/images/2019-09-03/0*NLaeu9cQtZRFtBtn.avif)

We can test what is affected, like this:

```
nx affected:test --parallel _\# runs tests for \`api-interfaces\`, \`api\`, and \`tickets\` in parallel._
```

We can also easily distribute the tests across a grid of machines on CI.

Read more about it [here](https://nx.dev/react/guides/monorepo-affected).

## Variability

Even our tiny workspace already has a bunch of technologies in it.

```
apps/
  agent/        - Angular app
  agent-e2e/    - Cypress tests
  api/          - Express app
  tickets/      - React app
  tickets-e2e/  - Cypress testslibs/
  api-interfaces/ - simple TypeScript lib
  ticket-list/    - a React lib
...
```

Even though Nx uses Webpack, Cypress, Jest, ESLint under the hood, it provides a unified command-line interface, so we can interact with all the projects in the same way.

`nx lint agent` will use tslint, while `nx lint tickets` will use eslint. `nx serve api` will start the express app, and `nx serve tickets` will start webpack dev server. Each of those commands can have a completely different implementation with different flags. So we don’t lose any flexibility, we merely standardize how we invoke the commands.

This is what allows `nx affected` to work. Running `nx affected:lint` will relint the affected libraries and applications and will use the appropriate linter for each project. Similarly, `nx affected:test` will retest what is affected and will use the appropriate test runner where needed.

It also helps with developer mobility. One of the benefits of a monorepo is that folks can reuse each other’s code and contribute to each other’s projects. Being able to discover what commands a project has, and how to `serve/test/build` it, is key for enabling it.

## Summary

- Monorepos are useful for both open source projects and companies building applications.
- A monorepo for an open source project can consist of a dozen similar packages, built by a single team using similar tools.
- A monorepo for an organization can consist of hundreds of packages, many of them are applications, built by multiple independent team using different tools.
- Lerna is optimized for the former. Nx is optimized for the latter.

## Learn More

- Video: [Extensible Dev Tools for Monorepos for Angular Devs](https://www.youtube.com/watch?v=mVKMse-gFBI)
- Video: [Extensible Dev Tools for Monorepos for React Devs](https://www.youtube.com/watch?v=E188J7E_MDU)
- Book: [Effective React Development with Nx](https://go.nrwl.io/react-book)
- Book: [Angular Enterprise Monorepo Patterns](https://go.nrwl.io/angular-enterprise-monorepo-patterns-new-book)

### Victor Savkin is a co-founder of [Nrwl](https://nrwl.io). We help companies develop like Google, Facebook, and Microsoft since 2016. We provide consulting, engineering and tools.

![](/blog/images/2019-09-03/0*DmHWkqT652zawIwC.avif)

_If you liked this, click the_ 👏 _below so other people will see this here on Medium. Follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._

![](/blog/images/2019-09-03/1*pbElIZt9YeORNw8m142z6w.avif)
