---
title: 'create-nx-workspace - CLI command'
description: 'Create a new Nx workspace'
---

# create-nx-workspace

Create a new Nx workspace

## Usage

```bash
create-nx-workspace [name] [options]
```

Install `create-nx-workspace` globally to invoke the command directly, or use `npx create-nx-workspace`, `yarn create nx-workspace`, or `pnpx create-nx-workspace`.

## Options

### allPrompts

Type: `boolean`

Default: `false`

Show all prompts

### appName

Type: `string`

The name of the app when using a monorepo with certain stacks

### bundler

Type: `string`

Bundler to be used to build the app

### commit.email

Type: `string`

E-mail of the committer

### commit.message

Type: `string`

Default: `Initial commit`

Commit message

### commit.name

Type: `string`

Name of the committer

### defaultBase

Type: `string`

Default: `main`

Default base to use for new projects

### docker

Type: `boolean`

Generate a Dockerfile for the Node API

### e2eTestRunner

Type: `string`

Choices: [playwright, cypress, none]

Test runner to use for end to end (E2E) tests.

### framework

Type: `string`

Framework option to be used with certain stacks

### help

Type: `boolean`

Show help

### interactive

Type: `boolean`

Default: `true`

Enable interactive mode with presets

### name

Type: `string`

Workspace name (e.g. org name)

### nextAppDir

Type: `boolean`

Enable the App Router for Next.js

### nextSrcDir

Type: `boolean`

Generate a 'src/' directory for Next.js

### nxCloud

Type: `string`

Choices: [yes, github, circleci, skip]

Do you want Nx Cloud to make your CI fast?

### packageManager

Type: `string`

Choices: [bun, npm, pnpm, yarn]

Default: `npm`

Package manager to use

### prefix

Type: `string`

Prefix to use for Angular component and directive selectors.

### preset

Type: `string`

Customizes the initial content of your workspace. Default presets include: ["apps", "npm", "ts", "web-components", "angular-monorepo", "angular-standalone", "react-monorepo", "react-standalone", "vue-monorepo", "vue-standalone", "nuxt", "nuxt-standalone", "next", "nextjs-standalone", "remix-monorepo", "remix-standalone", "react-native", "expo", "nest", "express", "react", "vue", "angular", "node-standalone", "node-monorepo", "ts-standalone"]. To build your own see https://nx.dev/extending-nx/recipes/create-preset

### routing

Type: `boolean`

Default: `true`

Add a routing setup for an Angular app

### skipGit

Type: `boolean`

Default: `false`

Skip initializing a git repository

### ssr

Type: `boolean`

Enable Server-Side Rendering (SSR) and Static Site Generation (SSG/Prerendering) for the Angular application

### standaloneApi

Type: `boolean`

Default: `true`

Use Standalone Components if generating an Angular app

### style

Type: `string`

Stylesheet type to be used with certain stacks

### useGitHub

Type: `boolean`

Default: `false`

Will you be using GitHub as your git hosting provider?

### version

Type: `boolean`

Show version number

### workspaceType

Type: `string`

Choices: [integrated, package-based, standalone]

The type of workspace to create
