<p style="text-align: center;">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-dark.svg">
    <img alt="Nx - Smart Monorepos · Fast CI" src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-light.svg" width="100%">
  </picture>
</p>

{{links}}

<hr>

# Nx: Smart Monorepos · Fast CI

Nx is a build system, optimized for monorepos, with plugins for popular frameworks and tools and advanced CI capabilities including caching and distribution.

<div style="text-align: center;">

<img src="http://github.com/nrwl/angular-rspack/raw/main/rsbuild-plugin-angular.png" alt="Rsbuild Plugin Angular" />

</div>

## @nx/angular-rspack

[![GitHub Actions](https://github.com/nrwl/angular-rspack/actions/workflows/ci.yml/badge.svg)](https://github.com/nrwl/angular-rspack/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/License-MIT-blue)
[![NPM Version](https://img.shields.io/npm/v/%40ng-rspack%2Fbuild?label=%40nx%2Fangular-rspack)](https://www.npmjs.com/package/@ng-rspack/build)

## Build Angular with Rspack

The goal of `@nx/angular-rspack` is to make easy and straightforward to build Angular applications with [rspack](https://rspack.dev).

### Getting Started

#### Step 1: Create a new Nx Workspace with Angular Rspack Application

```bash
npx create-nx-workspace myorg

NX   Let's create a new workspace [[https://nx.dev/getting-started/intro](https://nx.dev/getting-started/intro)]
✔ Which stack do you want to use? · angular
✔ Integrated monorepo, or standalone project? · integrated
✔ Application name · myorg
✔ Which bundler would you like to use? · rspack
✔ Default stylesheet format · css
✔ Do you want to enable Server-Side Rendering (SSR)? · No
✔ Which unit test runner would you like to use? · vitest
✔ Test runner to use for end to end (E2E) tests · playwright
✔ Which CI provider would you like to use? · skip
✔ Would you like remote caching to make your build faster? · skip
NX   Creating your v20.8.0 workspace.
```

#### Step 2: Run Build and Serve commands

```bash
npx nx build myorg
npx nx serve myorg
```

{{content}}
