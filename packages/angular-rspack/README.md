![Nx](https://raw.githubusercontent.com/nrwl/nx/master/images/nx-light.svg)
<div style="text-align: center;">

# @nx/angular-rspack

[![GitHub Actions](https://github.com/nrwl/angular-rspack/actions/workflows/ci.yml/badge.svg)](https://github.com/nrwl/angular-rspack/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/License-MIT-blue)
[![NPM Version](https://img.shields.io/npm/v/%40ng-rspack%2Fbuild?label=%40nx%2Fangular-rspack)](https://www.npmjs.com/package/@ng-rspack/build)

</div>

<hr>

# Build Angular with Rspack

The goal of `@nx/angular-rspack` is to make easy and straightforward to build Angular applications with [rspack](https://rspack.dev).

## Getting Started

### Step 1: Create a new Nx Workspace with Angular Rspack Application

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

### Step 2: Run Build and Serve commands

```bash
npx nx build myorg
npx nx serve myorg
```


## Documentation and Resources

- [Read the Angular Rspack Documentation](https://nx.dev/recipes/angular/rspack/introduction)
- [Nx.Dev: Documentation, Guides, Tutorials](https://nx.dev)
- [Intro to Nx](https://nx.dev/getting-started/intro)
- [Official Nx YouTube Channel](https://www.youtube.com/@NxDevtools)
- [Blog Posts About Nx](https://nx.dev/blog)

<p style="text-align: center;"><a href="https://nx.dev/#learning-materials" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-courses-and-videos.svg" 
width="100%" alt="Nx - Smart Monorepos · Fast CI"></a></p>
