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

### ci

Type: `string`

Choices: [github, circleci, azure, bitbucket-pipelines, gitlab]

Generate a CI workflow file

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

### nxCloud

Type: `boolean`

Enable distributed caching to make your CI faster

### packageManager

Type: `string`

Choices: [npm, pnpm, yarn]

Default: `npm`

Package manager to use

### preset

Type: `string`

Customizes the initial content of your workspace. Default presets include: ["apps", "empty", "core", "npm", "ts", "web-components", "angular-monorepo", "angular-standalone", "react-monorepo", "react-standalone", "next", "nextjs-standalone", "react-native", "expo", "nest", "express", "react", "angular", "node-standalone", "node-monorepo", "ts-standalone"]. To build your own see https://nx.dev/plugins/recipes/create-preset

### routing

Type: `boolean`

Add a routing setup for an Angular app

### skipGit

Type: `boolean`

Default: `false`

Skip initializing a git repository

### standaloneApi

Type: `boolean`

Use Standalone Components if generating an Angular app

### style

Type: `string`

Stylesheet type to be used with certain stacks

### version

Type: `boolean`

Show version number

### workspaceType

Type: `string`

Choices: [integrated, package-based, standalone]

The type of workspace to create
