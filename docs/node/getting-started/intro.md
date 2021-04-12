# Intro to Nx

Nx is a suite of powerful, extensible dev tools that help you develop, test, build, and scale [Node](/{{framework}}/node/overview) applications.

## 10-Minute Nx Overview

<iframe width="560" height="315" src="https://www.youtube.com/embed/cXOkmOy-8dk" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Philosophy

Nx is built on a technology agnostic core that maintains modular units of code and understands the dependency graph between them. Developers comprehend that your app contains two pages that each use a shared button component. Nx uses this same knowledge to provide insights and performance improvements. There's a whole ecosystem of plugins that build on this foundation.

Nx becomes more valuable as you scale, solving problems that are frustrating for small teams, but paralyzing for large teams.

Nx works especially well for [monorepos](/{{framework}}/core-concepts/why-monorepos). Each new app added to a monorepo provides more opportunities to share code and tooling but that often comes at the cost of a compounding slowdown in the CI pipeline. Nx ensures that adding another app to the repo does not increase the existing app’s test or build time.

## Features

- Test (or builds or lints) only the projects [affected](/{{framework}}/cli/affected) by a code change.
- [Cache](/{{framework}}/core-concepts/computation-caching) command output locally so that future runs on the same code happen in seconds. The paid [Nx Cloud](https://nx.app) offering allows this cache to be shared across every developer in your organization.
- Provide a consistent syntax for [executing commands](/{{framework}}/executors/using-builders). `nx build my-app` works no matter what framework `my-app` uses.
- Automate code modification tasks with [generators](/{{framework}}/cli/affected).
- Access a thriving ecosystem of [plugins](/{{framework}}/generators/using-schematics) from Nrwl and the [community](/nx-community).

## Learn Nx Fundamentals

- [Interactive Nx Tutorial (with videos)](/{{framework}}/tutorial/01-create-application)
- [Free Nx Course on YouTube](https://www.youtube.com/watch?time_continue=49&v=2mYLe9Kp9VM&feature=emb_logo)

## Dive Deep

- [Nx CLI](/{{framework}}/getting-started/nx-cli)
- [Configuration Files](/{{framework}}/core-concepts/configuration)
- [Computation Caching](/{{framework}}/core-concepts/computation-caching)
- [Rebuilding What is Affected](/{{framework}}/core-concepts/affected)
