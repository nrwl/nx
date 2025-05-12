---
title: 'Nx 14.5 — Cypress v10, output globs, linter perf, React Tailwind support'
slug: 'nx-14-5-cypress-v10-output-globs-linter-perf-react-tailwind-support'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-08-02/ZUzLD-4JgrEBIZb3dXOvag.avif'
tags: [nx, release]
description: 'Nx 14.5 adds Cypress v10 with component testing, glob-based outputs for better caching, and improved React Tailwind integration.'
---

Here we go! After not even a month of [releasing v14.4](/blog/nx-14-4-inputs-optional-npm-scope-project-graph-cache-directory-and-more), Nx v14.5 is out!! Here's all you need to know.

**TL;DR:** [https://github.com/nrwl/nx/releases/tag/14.5.0](https://github.com/nrwl/nx/releases/tag/14.5.0)

## Cypress v10 and Component Testing

Cypress v10 is probably the most significant update since Cypress was released. It comes with a new, exciting [Cypress App](https://docs.cypress.io/guides/core-concepts/cypress-app), component testing beta, a new JS/TS-based configuration file and much more. Read all the details in [their official announcement](https://www.cypress.io/blog/2022/06/01/cypress-10-release/).

One of the strengths of Nx is to integrate various tools into a cohesive, high-quality experience. Working together with other companies and open source projects is key to making sure we meet this goal. We have had an ongoing relationship with the folks over at Cypress for years already and have been working closely with them since earlier this year to integrate v10 into Nx in the best possible way.

This includes an upgrade script to automatically migrate Nx users using Cypress v9 seamlessly to v10. By running…

```shell
nx g @nrwl/cypress:migrate-to-cypress-10
```

…your workspace will be automatically upgraded to the latest Cypress version.

Cypress v10 also comes with a beta version of [Component Testing](https://docs.cypress.io/guides/component-testing/writing-your-first-component-test). Nx v14.5 comes with an integrated generator to add component testing support to React-based project:

```shell
nx g @nrwl/react:cypress-component-configuration --project=my-react-project --generate-tests
```

You can also append the `--generate-tests` to automatically generate Cypress component tests for the existing components in the target project (`my-react-project`).

```shell
nx g @nrwl/react:cypress-component-configuration --project=my-react-project --generate-tests
```

Check out our [generator docs](/nx-api/react/generators/cypress-component-configuration) for more info.

{% youtube src="https://youtu.be/QDWN4C7T-Ck" /%}

## Globs for Task Outputs

In v14.4 we [introduced inputs and namedInputs](/blog/nx-14-4-inputs-optional-npm-scope-project-graph-cache-directory-and-more). They allow you to fine-tune how caching works and when it should be invalidated.

```json {% fileName="nx.json" %}
{
    ...
    "targetDefaults": {
        "build": {
            "inputs": ["!{projectRoot}/**/*.spec.ts"]
        }
    }
}
```

Specifying such inputs can drastically increase the number of cache hits!

{% tweet url="https://twitter.com/victorsavkin/status/1550187124678205440" /%}

In this release, we also allow specifying globs for `outputs`. Outputs are optional as Nx comes with reasonable defaults, but you can specify your own if your setup differs from the most commonly used ones:

```json {% fileName="nx.json" %}
{
    ...
    "targetDefaults": {
        "build": {
            ...
            "outputs": ["dist/libs/mylib"]
        }
    }
}
```

Globs are particularly useful when multiple targets write to the same directory. Say you have a `build-js` and `build-css` command and both write into `dist/libs/mylib`. For reasons of clarity, if possible, our recommendation is to split them up. Like:

```json {% fileName="nx.json" %}
{
  "build-js": {
    "outputs": ["dist/libs/mylib/js"]
  },
  "build-css": {
    "outputs": ["dist/libs/mylib/css"]
  }
}
```

Sometimes that's not feasible though. In that case, globs come in handy:

```json {% fileName="nx.json" %}
{
  "build-js": {
    "outputs": ["dist/libs/mylib/**/*.js"]
  },
  "build-css": {
    "outputs": ["dist/libs/mylib/**/*.css"]
  }
}
```

[Read more in our docs](/reference/project-configuration)

## Parameter Forwarding when building dependent projects

Besides the speed aspect, one key feature of Nx is the ability to build dependent projects automatically. Let's say you have `project-a` which depends on `project-b`, then whenever you run the build for `project-a`, thanks to its project graph, Nx will automatically run the build for `project-b` first. You can define such dependencies either directly in your [project.json](/reference/project-configuration) or [package.json](/reference/project-configuration) file, or globally for an entire workspace in `nx.json`:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

The `^` is a short-hand notation for

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "dependsOn": [{ "projects": "dependencies", "target": "build" }]
    }
  }
}
```

...and defines that the `build` task should be run for all its dependencies first.

> _You have a PNPM,NPM or Yarn workspace? Adding Nx doesn't only benefit you in terms of speed improvements, but also to define such build dependencies. Have a look at this video to learn more:_ [_Setup a monorepo with PNPM workspaces and add Nx for speed: Defining task dependencies aka build pipelines_](https://youtu.be/ngdoUQBvAjo?t=1485)

What happens to parameters when invoking the target on a project's dependencies? By default, they are not forwarded but starting with 14.5 you can. Here are some configuration options:

```json
"build": {
   // forward params passed to this target to the dependency targets
  "dependsOn": [
      { "projects": "dependencies", "target": "build", "params": "forward" }
  ]
},
"test": {
  // ignore params passed to this target, won't be forwarded to the dependency targets
  "dependsOn": [
      { "projects": "self", "target": "build", "params": "ignore" }
  ]
}
"lint": {
  // ignore params passed to this target, won't be forwarded to the dependency targets
  "dependsOn": [
      { "projects": "self", "target": "build" }
  ]
}
```

[Read more in our docs](/reference/project-configuration)

## Linting Performance

We are obsessed with performance, yes we are! And I have good news: the Nx module boundary lint rule just got an order of magnitude faster 🤯.

{% tweet url="https://twitter.com/meeroslav/status/1550058325236191232" /%}

Replacing `Sets`, `foreach`, `reduce` with plain `for` loops can often have quite a significant impact. You won't notice much on smaller projects, but on large Nx workspaces with 500+ projects you should see some huge improvements 🚀.

## Support for banned external imports lint checks on transitive dependencies

The [Nx Module Boundary lint rule](/features/enforce-module-boundaries) is a powerful concept especially when it comes to the maintainability aspect of projects and monorepos. Learn more in our blog article on [Taming Code Organization with Module Boundaries in Nx](/blog/mastering-the-project-boundaries-in-nx).

The Module Boundary rule allows for much more though. It also allows to ban external imports. Say you have a frontend project where you want to make sure none of the "backend-type" dependencies accidentally get imported. Or vice-versa, a backend project where you wouldn't necessarily want to depend on any "frontend-type" package references. You can use the `bannedExternalImports` for that. For example:

```json {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here // nx-enforce-module-boundaries should already exist at the top-level of your config
  "nx-enforce-module-boundaries": [
    "error",
    {
      "allow": [],
      // update depConstraints based on your tags
      "depConstraints": [
        // projects tagged with "frontend" can't import from "@nestjs/common"
        {
          "sourceTag": "frontend",
          "bannedExternalImports": ["@nestjs/common"]
        },
        // projects tagged with "backend" can't import from "@angular/core"
        {
          "sourceTag": "backend",
          "bannedExternalImports": ["@angular/core"]
        }
      ]
    }
  ] // ... more ESLint config here
}
```

Note, the `frontend` and `backend` `sourceTag` definition is something you define. You could have easily named it differently. It is a string that can be attached to a project by adding it to the `tag` property of its `project.json` configuration file. Read more about banned external imports [in our docs](/features/enforce-module-boundaries).

Starting with 14.5 we now support such checks also on transitive dependencies. Assume we have `project-a` and `project-b`, both of which are tagged as `framework-agnostic` and have `react` in their banned external imports. Also, assume there's a relationship like `project-a -> project-b`. If `project-b` imports `react` and we run linting, it fails correctly. However, if we run linting on `project-a`, it succeeds as `project-a` is not importing `react` at all, thus not breaking the lint rule. In most situations, this is fine because linting happens at a project level, but sometimes you might want to have a "transitive" behavior where linting would also fail for `project-a` because it imports `project-a` which imports `react`.

You can now enable such behavior by setting `checkNestedExternalImports` to `true`:

```json {% fileName=".eslintrc.json" %}
{
  // ... more ESLint config here // nx-enforce-module-boundaries should already exist at the top-level of your config
  "nx-enforce-module-boundaries": [
    "error",
    {
      "allow": [],
      "checkNestedExternalImports": true,
      // update depConstraints based on your tags
      "depConstraints": [
        // projects tagged with "frontend" can't import from "@nestjs/common"
        {
          "sourceTag": "framework-agnostic",
          "bannedExternalImports": ["react"]
        }
      ]
    }
  ]
  // ... more ESLint config here
}
```

## Improved automated Module Boundary Lint Rule fixes

In v13.10 we introduced automated fixes for the Nx Module Boundary rules. Wrong relative imports such as the following can be easily adjusted automatically by providing the `--fix` when running linting on the project.

![](/blog/images/2022-08-02/dhbe8hFyjEm_K86A.avif)

This is a huge time saver, especially on large projects. With Nx v14.5 the automated fixes now also support automated resolution of absolute imports across library boundaries, such as

```typescript
// WRONG
import { libSayHi } from 'libs/tslib-a/src/index';

// automatically fixed to
import { libSayHi } from '@myorg/tslib-a';
```

## Nx Migrate improvements and Nx Repair

We improved our log output from the Nx automated code migration run to make it more clear what a code migration actually changes. Also, those migrations that don't do anything because they don't apply to your workspace are not shown in the output at all.

![](/blog/images/2022-08-02/IWGJcienK4L_oGxl.avif)

## Tailwind Setup Generator for React

It has never been easier to add [Tailwind](https://tailwindcss.com/) support to your React app or library. Just run the `setup-tailwind` generator:

```shell
npx nx g @nrwl/react:setup-tailwind --project=<project-name>
```

![](/blog/images/2022-08-02/H1XArfg-tCgD0ZUp.avif)

This automatically sets up your project with a PostCSS and Tailwind configuration.

## React Native: Add Detox config to Expo apps

We also improved our React Native support by adding the possibility to generate a [Detox](https://wix.github.io/Detox/) config for Expo applications.

## Deprecating Angular Protractor e2e tests

[Protractor](https://github.com/angular/protractor/issues/5502) has been deprecated for a while on the Angular CLI side and given Nx has had [Cypress](https://cypress.io/) support for a while it has never been a popular choice. Starting with this release we're deprecating the generator for setting up Protractor and we're planning on removing support entirely in Nx v15.

## Other Package updates

Here are some more package updates that come with this release and will automatically be bumped when you run the Nx migration:

- Angular v14.1.0
- Express 14.18.1
- Nest v9
- Next.js v12.2.2
- React Native 0.69.1
- React Native Metro v0.71.3
- React 18.0.15
- `eslint-plugin-jsx-a11y` v6.6.1

For an exhaustive list check our release changelog on GitHub: [https://github.com/nrwl/nx/releases/tag/14.5.0](https://github.com/nrwl/nx/releases/tag/14.5.0)

## How to Update Nx

Updating Nx is done with the following command, and will update your Nx workspace dependencies and code to the latest version:

```shell
npx nx migrate latest
```

After updating your dependencies, run any necessary migrations.

```shell
npx nx migrate --run-migrations
```

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
