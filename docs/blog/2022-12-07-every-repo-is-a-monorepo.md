---
title: 'Every Repo is a Monorepo'
slug: 'every-repo-is-a-monorepo'
authors: ['Victor Savkin']
cover_image: '/blog/images/2022-12-07/1*bi-wuSawGVuteKsIdJugSg.png'
tags: [nx]
---

When comparing “regular” repos and monorepos we imagine this:

A **regular repo** is a single node comprising a set of source files and a set of operations (e.g., npm scripts in the root `package.json`).

A **monorepo** has multiple such nodes: each has its own sets of files and operations. Those nodes can also depend on each other.

I claim this distinction is bogus. Every repo, apart from the most trivial ones, has multiple easily-identifiable nodes with their own sets of operations and dependencies between them. The only reason why we don’t model those projects as monorepos is because the overhead of the monorepo tooling is high. Too much ceremony, so it’s cumbersome.

**But what if the overhead was zero?**

## Example

Let’s use Nx to create a standalone React application (_this is a new option introduced in Nx 15.3_):

```shell
npx create-nx-workspace@latest --preset=react-standalone
```

This is the result:

```
e2e/
  src/
  cypress.config.ts
  project.json
  ...
src/
  app/
  main.tsx
  ...
public/
index.html

project.json
tsconfig.spec.json
tsconfig.app.json
tsconfig.json
vite.config.ts
nx.json
package.json
```

If we run `nx graph` we will see that the workspace has 2 nodes:

![](/blog/images/2022-12-07/1*FJpof07_DwbfjRmqJbOQBw.avif)

- the application itself
- a cypress-powered set of e2e tests

So even the most trivial example already has several nodes which are clearly distinct.

We can build, serve, unit test the app itself. For instance, running `nx build` produces the following:

```
> nx run shop:build:production

vite v3.2.4 building for production...
✓ 32 modules transformed.
dist/shop/index.html                 0.39 KiB
dist/shop/assets/index.b0377f06.js   161.28 KiB / gzip: 50.37 KiB
dist/shop/assets/index.b0377f06.js.map 377.94 KiB

———————————————————————————————————————————————————————————————————————
 >  NX   Successfully ran target build for project shop (2s)
```

We can run the e2e tests by executing `nx e2e e2e`. This will start the app and will run a set of cypress tests against it.

Note the app and the e2e tests are clearly distinct. We can have different code standards for them. The tests depend on the app but the app doesn’t depend on the tests. The building of the app and the running of the e2e tests don’t have to happen at the same or on the same machine. One machine can build the application and another one can run the tests.

## Adding Design System

Let’s say that after a while we decided to separate the application from the UI components from which it is built. I.e., we decided to extract some ui library or a design system.

Let’s use Nx to generate a library for this purpose.

```
# we don't need the default component
nx g lib design-system --buildable --no-component

# gen the button component and export it
nx g component button --project=design-system --export
```

This is the result:

```
e2e/
design-system/
  src/
    lib/
      button.tsx
    index.ts
  project.json
public/
src/

project.json
tsconfig.base.json
tsconfig.spec.json
tsconfig.app.json
tsconfig.json
vite.config.ts
nx.json
package.json
```

We can import the design system components in our main app like this:

```
import { Button } from '@shop/design-system'
```

One thing which is pretty common is being able to develop and test the design system components in isolation. We can use Storybook and Cypress for that.

```
nx g storybook-configuration design-system
```

This command will generate stories for all the components in the design system library. You will see a `.stories` file next to each component.

```
button.spec.tsx
button.stories.tsx
button.tsx
```

And will generate a suite of e2e tests for those components:

```
design-system-e2e/
  src/
    e2e/
      button/button.cy.tx
  project.json
```

Now if we run: `nx build design-system` we'll build the design system. And if we run `nx e2e design-system-e2e`, we'll run e2e tests for it.

This is what the workspace graph looks like now:

![](/blog/images/2022-12-07/1*VGsc37yl7kG36vvwTxeOTA.avif)

## Upgrading CI Setup

To make this example more interesting I’m going to change how we serve the storybook setup and the application when we run the e2e tests.

When running locally we often want to “serve” the app in memory because we tend to iterate on the app while rerunning the tests. CI is different. There is zero value in serving the app while running the tests on CI. It’s often better to build the app and serve that `dist` folder.

With Nx, it’s trivial to do. We need to add another target (let’s call it `serve-static`) to the shop app and the design system. This is how we do it for the app:

```
"serve-static": {
  "executor": "@nrwl/web:file-server",
  "options": {
    "buildTarget": "shop:build"
  }
}
```

And then I just need to add this configuration to my e2e tests projects:

```
"targets": {
  "e2e": {
    "executor": "@nrwl/cypress:cypress",
    "options": {
      "cypressConfig": "e2e/cypress.config.ts",
      "devServerTarget": "shop:serve:development",
      "testingType": "e2e"
    },
    "configurations": {
      "ci": {
        "devServerTarget": "shop:serve-static"
      }
    }
  }
}
```

## Task Pipelining & Caching

Note, because Nx is aware of how the repo is structured, it can run commands against the repo in the most optimal way. For instance, if we run: `nx run-many --target=e2e --configuration=ci`the build system is going to execute the following tasks:

```
✔  nx run design-system:build (1s)
✔  nx run shop:build (2s)
✔  nx run e2e:e2e:ci (10s)
✔  nx run design-system-e2e:e2e:ci (19s)

——————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target e2e for 2 projects and
         2 task(s) they depend on (21s)
```

Nx is smart to run these tasks in the correct order:

- It’s going to build the design system first (the app cannot be built until the design system is built).
- It’s going to build the app.
- At the same time, it can start running e2e tests for the design system. **I.e., the building of the app and the testing of the design system can happen in parallel.**
- Finally, once the app is built, Nx is going to run e2e tests against it.

Secondly, because Nx knows how things are wired up and when they change, it can cache the results of each of those tasks. If we change the app only and rerun the same command, this is what we’ll see:

```
✔  nx run design-system:build  [existing outputs match the cache, left as is]
✔  nx run design-system-e2e:e2e:ci  [existing outputs match the cache, left as is]
✔  nx run shop:build (1s)
✔  nx run e2e:e2e:ci (7s)

——————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target e2e for 2 projects and
         2 task(s) they depend on (8s)
         Nx read the output from the cache instead of running
         the command for 2 out of 4 tasks.
```

Nx read the output from the cache instead of running the command for 2 out of 4 tasks.

Let’s pause for a second.

Imagine we didn’t have Nx and built this using ad-hoc scripts and tools. We would not have:

- caching (everything would be rebuilt/reran every time)
- task pipelining (everything would be built first before running e2e tests).
- the app would not be able to consume the design system build artifacts without a lot of custom configuration.

With Nx, we were able to give this repo a bit more structure, which made things clearer and faster. And, what is more, everything here is distributable: the e2e command shown above can run across multiple machines.

## Embracing Nx

The example above simply reifies the structure that would have already been present in any repo building a React app. The app itself, the e2e tests are written in exactly the same way they would have been without Nx. **However, Nx can actually improve how you write your application: it can become better architected and easier to maintain.**

Let’s imagine the application has three sections: admin, client, and marketing — they all have their own sets of features and they can also share some code. Maybe different people work on those sections. Just to sketch out what is possible, let’s generate a lib per section:

```
nx g lib features/admin
nx g lib features/client
nx g lib features/marketing
nx g lib shared # code that al sections can share
```

We can move the code associated with those areas into those sections and then wire them up in the `app.tsx`.

This is the layout:

```text
e2e/
design-system-e2e/

design-system/
features/
  admin/
  client/
  marketing/
shared/

public/
src/

project.json
tsconfig.base.json
tsconfig.spec.json
tsconfig.app.json
tsconfig.json
vite.config.ts
nx.json
package.json
```

![](/blog/images/2022-12-07/1*tchlJfrLxZor3j-AqdREqw.avif)

### Establishing Invariants

You want to make sure folks from `admin` don’t depend on `client`, but both can depend on `shared`. Nx lets you describe those invariants and they become statically enforced (read more [here](/blog/mastering-the-project-boundaries-in-nx)). Most applications that are written in a single repo are big balls of mud, where things cross-import each other.

### Real Scale

Currently, the repo has eight nodes, but it is just an illustration. If this was a real project and the shop app was built by hundreds of engineers, each of the sections (admin, client, marketing) could have consisted of dozens or even hundreds of libs. You, also, would not have a single suite of e2e tests and instead have multiple suites targeting different sections of the app.

### Fast

Now if I’m working on the marketing section and I only change that, what would I have to retest and rebuild?

![](/blog/images/2022-12-07/1*0xPunCSgXvxyjEAmCFOa5A.avif)

As you can see only a third of my repo has to be rebuilt and retested (_Nx knows what needs to be rebuilt and retested, so none of it requires any configuration_).

In a bigger repo, this percentage can go down even more. Plus, this is all distributable as well.

## When did it become a monorepo?

We started with a simple repo consisting of two nodes: an app and its e2e tests. In the end, we had eight. We didn’t have to refactor or rearchitect anything. We didn’t have to move files around. The process was gradual. **We started with something simple and only added the structure we benefited from, which made the repo faster and the app better architected.**

![](/blog/images/2022-12-07/1*EnQGJIlxaPPwkRaTDDXPVg.avif)

**We didn’t have to decide between a regular repo or a monorepo, and at no point did such a transition occurred.**

The picture on the right has a single app, has no “yarn workspaces”, and it’s not “Google scale”. Is it a monorepo?

Whatever we call it, it is faster, more scalable, and more maintainable.

## Learn More

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)
