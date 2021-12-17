# Intro to Nx

Nx is a smart, fast and extensible build system. It comes with first class monorepo support and powerful integrations.

## 10-Minute Nx Overview

<iframe width="560" height="315" src="https://www.youtube.com/embed/iIh5h_G52kI" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Philosophy

Nx is built on a technology agnostic core that maintains modular units of code and understands the dependency graph between them. Developers comprehend that your app contains two pages that each use a shared button component. Nx uses this same knowledge to provide insights and performance improvements. There's a whole ecosystem of plugins that build on this foundation.

Nx becomes more valuable as you scale, solving problems that are frustrating for small teams, but paralyzing for large teams.

Nx works especially well for [monorepos](/{{framework}}/core-concepts/why-monorepos). Each new app added to a monorepo provides more opportunities to share code and tooling but that often comes at the cost of a compounding slowdown in the CI pipeline. Nx ensures that adding another app to the repo does not increase the existing app’s test or build time.

## Features

**Best-in-Class Support for Monorepos**

- [Smart rebuilds of affected projects](/{{framework}}/core-concepts/mental-model)
- [Distributed task execution & computation caching](/{{framework}}/core-concepts/mental-model)
- [Code sharing and ownership management](/{{framework}}/structure/monorepo-tags)

**Integrated Development Experience**

- [High-quality editor plugins](/{{framework}}/getting-started/console) & [GitHub apps](https://github.com/apps/nx-cloud)
- [Powerful code generators](/{{framework}}/generators/using-schematics)
- [Workspace visualizations](/{{framework}}/structure/dependency-graph)

**Supports Your Ecosystem**

- [Rich plugin ecosystem](/{{framework}}/core-concepts/nx-devkit) from Nrwl and the [community](/community)
- Consistent dev experience for any framework
- [Automatic upgrade to the latest versions of all frameworks and tools](/{{framework}}/core-concepts/updating-nx)

## Learn Nx Fundamentals

- [Interactive Nx Tutorial (with videos)](/{{framework}}/tutorial/01-create-application)
- [Using Nx Core Without Plugins](/{{framework}}/getting-started/nx-core)
- [Free Nx Course on YouTube](https://www.youtube.com/watch?time_continue=49&v=2mYLe9Kp9VM&feature=emb_logo)
- [Nx CLI](/{{framework}}/getting-started/nx-cli)
- [Configuration Files](/{{framework}}/core-concepts/configuration)
- [Mental Model](/{{framework}}/core-concepts/mental-model)
