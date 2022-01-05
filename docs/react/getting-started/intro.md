# Intro to Nx

Nx is a smart, fast and extensible build system with first class monorepo support and powerful integrations.

Nx helps you develop [React](/{{framework}}/react/overview) applications with fully integrated support for modern tools
and libraries like [Jest](/{{framework}}/jest/overview), [Cypress](/{{framework}}/cypress/overview),
Storybook, [ESLint](/{{framework}}/linter/eslint), and more. Nx also supports React
frameworks like [Gatsby](/{{version}}/react/gatsby/overview) and [Next.js](/{{version}}/react/guides/nextjs).

## 10-Minute Nx Overview

<iframe width="560" height="315" src="https://www.youtube.com/embed/sNz-4PUM0k8" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

## Philosophy

Nx is built on a technology-agnostic core that maintains modular units of code and understands the dependency graph
between them. Developers comprehend that your app contains two pages that each use a shared button component. Nx uses
this same knowledge to provide insights and performance improvements. There's a whole ecosystem of plugins that build on
this foundation.

Nx becomes more valuable as you scale, solving problems that are frustrating for small teams, but paralyzing for large
teams.

Nx works especially well for monorepos. Each new app added to a monorepo
provides more opportunities to share code and tooling but that often comes at the cost of a compounding slowdown in the
CI pipeline. Nx ensures that adding another app to the repo does not increase the existing app’s test or build time.

## Nx Core and Nx Plugins

Nx shares the design philosophy with Visual Studio Code. Code is a powerful text editor, and you can be very productive
with it even if you don't install any extensions. The ecosystem of VSCode's extensions though is what can really level
up your productivity. Nx is similar. The core of Nx is generic, simple, and unobtrusive. Nx plugins, although very
useful for many projects, are completely optional.

Most examples on this site use Nx plugins. It's just easier to demonstrate many features Nx offers when Nx generates all
the boilerplate. The vast majority of the features though will work the same way in a workspace with no plugins.

Check out [Using Nx Core Without Plugins](/{{framework}}/getting-started/nx-core) to see where Nx Core ends and Nx Plugins
begin. Check out [Nx and Typescript](/{{framework}}/getting-started/nx-and-typescript) to see how to build TypeScript packages with Nx.

## Features

**Best-in-Class Support for Monorepos**

- [Smart rebuilds of affected projects](/{{framework}}/using-nx/affected)
- [Computation caching](/{{framework}}/using-nx/caching)
- [Distributed task execution](/{{framework}}/using-nx/dte)
- [Code sharing and ownership management](/{{framework}}/structure/monorepo-tags)

**Integrated Development Experience**

- [High-quality editor plugins](/{{framework}}/using-nx/console) & [GitHub apps](https://github.com/apps/nx-cloud)
- [Powerful code generators](/{{framework}}/generators/using-schematics)
- [Workspace visualizations](/{{framework}}/structure/dependency-graph)

**Supports Your Ecosystem**

- [Rich plugin ecosystem](/{{framework}}/getting-started/nx-devkit) from Nrwl and the [community](/community)
- Consistent dev experience for any framework
- [Automatic upgrade to the latest versions of all frameworks and tools](/{{framework}}/using-nx/updating-nx)

## Learn Nx Fundamentals

- [Interactive Nx Tutorial (with videos)](/default/react-tutorial/01-create-application)

- [Free Nx Course on Egghead: Scale React Development with Nx](https://egghead.io/playlists/scale-react-development-with-nx-4038)
- [45-Minute Walkthrough](https://www.youtube.com/watch?v=jCf92IyR-GE)
- [Nx CLI](/{{framework}}/using-nx/nx-cli)
- Configuration Files: [package.json](/{{framework}}/configuration/packagejson) and [project.json](/{{framework}}/configuration/projectjson)
- [Mental Model](/{{framework}}/using-nx/mental-model)
