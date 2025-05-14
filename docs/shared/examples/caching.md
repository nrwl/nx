---
title: 'Large Next.js Apps Made Faster with Nx'
description: 'Explore how Nx optimizes and speeds up large Next.js applications with shared components, buildable packages, and efficient caching strategies.'
---

# File Large Next.js Apps Made Faster by Using Nx

Repo contains:

- 5 shared buildable packages/libraries with 250 components each
- 5 Next.js applications built out of 20 app-specific libraries. Each app-specific lib has 250 components each. Each library uses the shared components.

The repo shows how Nx works in a large workspace. It also benchmarks Nx and explains the optimisations Nx uses to be fast.

{% github-repository url="https://github.com/vsavkin/large-monorepo" /%}
