---
modified: 2025-05-19
---

The overall docs sidebar navigation structure should look as follows:

```
├── Getting Started
├── Features
├── Core Recipes
├── Technologies
├── Concepts
└── Reference
```

## Getting started section

Should have the following structure:

```
├── Getting Started
│   ├── Introduction
│   ├── Quick Start
│   ├── Installation
│   ├── Editor Integration
│   └── How Nx works
```

Some implementation notes:

- Introduction (/getting-started/intro) - high level overview of Nx
  - Target: users that are completely new to Nx and want to learn more/explore
  - Content
    - What Nx is and core value proposition (e.g. the pain points Nx solves)
      - Some of this content is in `/Users/juri/nrwl/oss/nx/docs/shared/getting-started/why-nx.md`
    - Quick 5 minute overview video
    - Who it is for
    - Key benfits
    - Clear pathways based on the user/role on where to go next/what to explore next in the documentation
- Quick Start - should be divided into 3 clear sections (maybe even with some visual support - [see Turbo docs](https://turborepo.com/docs/getting-started))
  - Install Nx - mention the global installation, the possibility to install standalone as well as over NPM / brew. Point to the installation instructions for more details
  - Initialize - into an existing repository using `nx init` or create a new project with `create-nx-workspace`
  - Going forward / Learning Path - this should include the next steps with 4 big buttons organized in grid:
    - Explore Nx Features
    - Learn about Nx on CI
    - Tutorials
    - Explore concrete src code examples
- Installation - Can remain almost unchanged as currently in `/Users/juri/nrwl/oss/nx/docs/shared/getting-started/installation.md`
- Editor Integration - Rename the current "Editor Setup" to "Editor Integration" (keep URL unchanged though). The current document `/Users/juri/nrwl/oss/nx/docs/shared/getting-started/editor-setup.md` can remain unchanged mostly.

## Features Section

Can remain as is.

## Core Recipes Section

All current recipes located under the `"id": "recipes",` in `/Users/juri/nrwl/oss/nx/docs/map.json` should be divided into

- Core recipes (going into this section)
- Technology specific recipes (see next paragraph)

Core recipes are those that belong to Nx itself, like how to run tasks, task caching, Nx release,...

## Technology Section

All current recipes located under the `"id": "recipes",` in `/Users/juri/nrwl/oss/nx/docs/map.json` should be divided into

- Core Recipes
- moved into a specific "Recipes" section of the technology they belong to in the "Technologies" section

The "Technologies" section is a top-level side-bar entry of the following structure:

```
├── Technologies
│   ├── TypeScript
│   ├── Angular
│   ├── React
│   ├── Vue
│   ├── Node
│   ├── Java
│   ├── Build Tools
│   │   ├── Webpack
│   │   ├── Vite
│   │   ├── Rollup
│   │   ├── ESBuild
│   │   ├── Rspack
│   │   └── Module Federation
│   ├── Testing Tools
│   │   ├── Cypress
│   │   ├── Jest
│   │   ├── Playwright
│   │   └── Storybook
│   └── Mobile
│       ├── React Native
│       ├── Expo
│       ├── Detox
│       └── NativeScript
```

Within each section there should be the following structure (using TypeScript as an example):

```
├── Technologies (or something like this)
│   ├── JavaScript
│   │   ├── Introduction
│   │   ├── Recipes
│   |   |   ├── ...
│   │   └── API
│   ├── Angular
│   │   ├── Introduction
│   │   ├── Recipes
│   |   |   ├── ...
│   │   └── API
│   ├── ...
```

Here's a quick explanation of these sections:

- Introduction - Similar to the global Nx overview page this should
  - give the benefits of what the specific technology plugin gives you / which pain points it helps solve for this specific technology.
  - show the quickstart instructions, like `nx init`, maybe explain the config options etc.
  - similar to he global quickstart it should have a section for the next steps / learning Path - this should include the next steps with 4 big buttons organized in grid (where tutorials and concrete src code examples would be technology specific):
    - Explore Nx Features
    - Learn about Nx on CI
    - Tutorials
    - Explore concrete src code examples
- Recipes - contain the recipes specific for this technology. These recipes should come from the overall section in `map.json`.
- API - what is currently linked from /nx-api (see `additional-api-references` in `map.json`) but for the specific technology at hand.

### Full structure

```
├── Technologies
│   ├── JavaScript/TypeScript
│   │   ├── Introduction
│   │   ├── Recipes
│   │   └── API
│   │
│   ├── Angular
│   │   ├── Core
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Angular Rspack
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── Angular Rsbuild
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   ├── React
│   │   ├── Core
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Next
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── Remix
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   ├── Vue
│   │   ├── Core
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── Nuxt
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   ├── Node.js
│   │   ├── Core
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Express
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── Nest
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   ├── Java
│   │   ├── Introduction
│   │   ├── Recipes
│   │   └── API
│   │
│   ├── .NET
│   │   ├── Introduction
│   │   ├── Recipes
│   │   └── API
│   │
│   ├── PHP
│   │   ├── Introduction
│   │   ├── Recipes
│   │   └── API
│   │
│   ├── Rust
│   │   ├── Introduction
│   │   ├── Recipes
│   │   └── API
│   │
│   ├── Build Tools
│   │   ├── Webpack
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Vite
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Rollup
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── ESBuild
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Rspack
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Module Federation
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── Rsbuild
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   ├── Testing Tools
│   │   ├── Cypress
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Jest
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Playwright
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── Storybook
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── Detox
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   ├── Mobile
│   │   ├── React Native
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── Expo
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   ├── Linting
│   │   ├── ESLint
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── ESLint Plugin
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   ├── Caching
│   │   ├── Azure Cache
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── GCS Cache
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   ├── S3 Cache
│   │   │   ├── Introduction
│   │   │   ├── Recipes
│   │   │   └── API
│   │   └── Shared FS Cache
│   │       ├── Introduction
│   │       ├── Recipes
│   │       └── API
│   │
│   └── Core Tools
│       ├── Nx
│       │   ├── Introduction
│       │   ├── Recipes
│       │   └── API
│       ├── Workspace
│       │   ├── Introduction
│       │   ├── Recipes
│       │   └── API
│       ├── Devkit
│       │   ├── Introduction
│       │   ├── Recipes
│       │   └── API
│       ├── Plugin
│       │   ├── Introduction
│       │   ├── Recipes
│       │   └── API
│       ├── Web
│       │   ├── Introduction
│       │   ├── Recipes
│       │   └── API
│       ├── JS
│       │   ├── Introduction
│       │   ├── Recipes
│       │   └── API
│       ├── Conformance
│       │   ├── Introduction
│       │   ├── Recipes
│       │   └── API
│       └── Owners
│           ├── Introduction
│           ├── Recipes
│           └── API
```

## Concepts Section

Can remain as is for now.

## Reference Section

Can mostly remain as is for now

## AI Automation

```
<role>
You are a documentation writer and technical writing expert, with domain knowledge in developer tooling, in particular frontend tooling, monorepos and Nx. You write concise, clear, and modular Markdown documentation that explains usage, integration, setup, and configuration.
</role>
```

- [Role prompts examples](https://gist.github.com/ruvnet/a206de8d484e710499398e4c39fa6299)
