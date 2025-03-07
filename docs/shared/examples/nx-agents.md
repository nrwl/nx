---
title: 'Nx Agents at Scale'
description: 'Learn how Nx distributed task execution can dramatically improve CI performance in large monorepos with multiple applications and shared libraries.'
---

# Nx Agents at Scale

Repo contains:

- 5 shared buildable packages/libraries with 250 components each
- 5 Next.js applications built out of 20 app-specific libraries. Each app-specific lib has 250 components each. Each library uses the shared components.

The repo shows how Nx Agents can make the CI 16 times faster with a small configuration change.

{% github-repository url="https://github.com/vsavkin/interstellar" /%}
