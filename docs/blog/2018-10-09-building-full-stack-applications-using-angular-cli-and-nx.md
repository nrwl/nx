---
title: 'Building Full-Stack Applications Using Angular CLI and Nx'
slug: 'building-full-stack-applications-using-angular-cli-and-nx'
authors: ['Victor Savkin']
cover_image: '/blog/images/2018-10-09/1*2EmPxA1HJtmUCoCVVgxGEw.png'
tags: [nx]
---

_Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools._

![](/blog/images/2018-10-09/1*TigvMknUeSYC2BWKvnDCTw.avif)

Nrwl Nx made building multiple Angular applications that share code easy. It cut the time of creating a shared library from days to minutes. But what about sharing code between the backend and the frontend? Our latest release of NX was built with this use case in mind and makes it easy. In this article we explore how we can use Nx to build multiple Angular applications, in combination with their API services, out of reusable libraries.

## Seeing is Believing

Often, when writing about Nx, we talk about the benefits of monorepos, dependency graphs, and advanced static analysis. In this post, however, we’ll show that you do not need to know any of this to leverage Nx to the greatest extent. The best practices here will enable you to be more effective, immediately.

## Starting by Creating a New Workspace

After we have installed [Nx](/getting-started/intro), let’s create a new workspace.

`create-nx-workspace myorg`

Nx is just an extension for the Angular CLI, so `create-nx-workspace` simple runs `ng new myorg --collection=@nrwl/schematics` and handles common pitfalls of using global npm packages. This command will create an empty workspace for us.

```
apps/
libs/
tools/
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

The apps and libs folders contain all the projects in the workspace.

- An **app** is something that we can run, either in the browser or on the server. Often building an app creates an optimized bundle. Apps cannot be reused in other apps.
- A **lib** is a reusable piece of code with well-defined public API. We cannot run a lib. We can only use it in another lib or in an app.

## Creating Apps

Say we are tasked with building an app for managing tickets. We can start by generating the app, like this: `ng g app tuskdesk`

```
apps/
  tuskdesk/
    src/
    app/
    assets/
    environments/
    favicon.ico
    index.html
    main.ts
    polyfills.ts
    styles.css
    test.ts
    browserslist
    karma.conf.js
    tsconfig.app.json
    tsconfig.spec.json
    tslint.json
    tuskdesk-e2e/
libs/
tools/
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

If you have used the Angular CLI, this should all look familiar: same configuration files, same folders. And this is because when generating an app, Nx runs a CLI command under the hood.

Now, imagine we also need to create the admin UI for managing tickets. We decided that it is a good idea to build it as a separate app to keep our consumer-facing application as lightweight and clean as possible.

`ng g app tuskdesk-admin`

```
apps/
  tuskdesk/
  tuskdesk-e2e/
  tuskdesk-admin/
  tuskdesk-admin-e2e/
libs/
tools/
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

To make things a bit more interesting, let’s say the two apps have a similar shell component.

and

The example is contrived, but illustrates an important point. It’s not uncommon to have basically the same component (or any piece of code) that is used in multiple contexts and apps.

**If we had developed the two apps in two separate repositories, extracting the two shell components into a reusable one would have been difficult.** We would have had to create a new project, set up testing, CI, deploy it to a private npm registry, etc.. As a result, we would have probably decided not to do it. Too hard to justify.

**When using Nx, it’s a matter of minutes.**

## Creating Libs

In Nx, we share code by using libs. So let’s create one called `ui-shell`.

```
ng g lib ui-shellapps/
  tuskdesk/
  tuskdesk-e2e/
  tuskdesk-admin/
  tuskdesk-admin-e2e/
libs/
  ui-shell/
    src/
      lib/
        ui-shell.module.ts
        ui-shell.module.spec.ts
      index.ts
      test.ts
    karma.conf.js
    tsconfig.lib.json
    tsconfig.spec.json
    tslint.json
tools/
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

Let’s generalize our component, and move it into `ui-shell`.

```
apps/
  tuskdesk/
  tuskdesk-e2e/
  tuskdesk-admin/
  tuskdesk-admin-e2e/
libs/
  ui-shell/
     src/
       lib/
         shell.component.ts
         ui-shell.module.ts
         ui-shell.module.spec.ts
       index.ts
       test.ts
     karma.conf.js
     tsconfig.lib.json
     tsconfig.spec.json
     tslint.json
tools/
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

Finally, we can update both the applications by importing the `ui-shell` lib and using the component.

Extracting this component took just a few minutes, and we can apply the whole refactoring in a single commit. Everything in the repository will always be consistent: before the refactoring and after the refactoring.

## Talking to APIs

But real-world applications don’t live in isolation — they need APIs to talk to. Let’s sketch something out.

Developing APIs in an Nx Workspace was always possible, but prior to Nx 6.4 it required a lot of manual setup, so few did it. Nx 6.4 changed that (Thank you, Jason Jean, for implementing this).

## Creating Node.js Apps

Nx uses Karma by default to test Angular applications and libraries. This isn’t possible for node applications. We decided to use the jest library for this purpose. To set up jest in the workspace we need to run ng g jest. We need to do it only once per workspace.

Now, let’s create a node application for the API.

```
ng g node-app apiapps/
  tuskdesk/
  tuskdesk-e2e/
  tuskdesk-admin/
  tuskdesk-admin-e2e/
  api/
    src/
      app/
      assets/
      environemnts/
      main.ts
    jest.config.js
    tsconfig.app.json
    tsconfig.spec.json
   tslint.json
libs/
  ui-shell/
tools/
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

And update `main.ts` to sketch out a simple service returning tickets.

After configuring the proxy (see [here](https://github.com/angular/angular-cli/blob/master/docs/documentation/stories/proxy.md)), we can launch both the API (`ng serve api`) and the app (`ng serve tuskdesk`). At this point we will see our application displaying the data.

We have a problem though. We defined `Ticket` twice: once on the frontend, once on the backend. This duplication will inevitably result in the two interfaces going out of sync, which means that runtime errors will creep in. We need to share this interface.

**Again, normally sharing code between the backend and the frontend would have required days of work, but with Nx, it’s done in just minutes.**

## Sharing Libs Between Frontend and Backend

```
ng g lib data — no-module — unit-test-runner=jestapps/
  tuskdesk/
  tuskdesk-e2e/
  tuskdesk-admin/
  tuskdesk-admin-e2e/
  api/
libs/
  data/
  ui-shell/
tools/
angular.json
nx.json
package.json
tsconfig.json
tslint.json
```

Now, we can move the `Ticket` interface into the data lib and update the frontend and the backend.

## Nx is Smart

We have already showed something amazing. We have a repository where we can build multiple Angular and Node.js applications and share code between them. And it took us just a few minutes.

But Nx can do a lot more than that. It knows how your apps and libs depend on each other. To see let’s run `npm run dep-graph` and you will see something like this:

![](/blog/images/2018-10-09/0*SJjREGFL8BCUteIh.avif)

This is the dependency graph of our workspace. Since Nx knows the graph, it can be smart about testing and building your projects.

If we run, say, `npm run affected:test --base=master` and you will only test the projects that can be affected by changes in your branch.

If we, for example, change the data library, the API and `tuskdesk` applications will be retested, and the `tuskdesk-admin` app won’t be as it doesn’t have a dependency on data. There are similar commands for building, linting, running e2e tests, etc.

Note that all of this works across frontend/backend boundaries.

## Try it out!

There are a lot of other things that Nx makes easy: developing state management, avoiding race conditions, standardizing on best practices, etc.

You can also find the full implementation of this example [in this repository.](https://github.com/nrwl/example-nx-fullstack)

## Angular Console

If you find all the generate, serve, build commands a bit intimidating, you aren’t the only one. How can you remember all these flags? You don’t have to.

**In collaboration with the Angular team, we put together a tool called Angular Console — the UI for the Angular CLI. It’s a great way to use the Angular CLI and Nx, and to learn about advanced features and flags these powerful tools provide.**

### Victor Savkin is a co-founder of Nrwl. We help companies develop like Google since 2016. We provide consulting, engineering and tools.

![](/blog/images/2018-10-09/0*NSLFXiKLN4PAjCOW.avif)

_If you liked this, follow_ [_@victorsavkin_](http://twitter.com/victorsavkin) _to read more about monorepos, Nx, Angular, and React._
