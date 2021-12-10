---
title: '@nrwl/node:execute executor'
description: 'Execute a Node application'
---

# @nrwl/node:execute

Execute a Node application

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### buildTarget (_**required**_)

Type: `string`

The target to run to build you the app

### args

Type: `array`

Extra args when starting the app

### host

Default: `localhost`

Type: `string`

The host to inspect the process on

### inspect

Default: `inspect`

Type: `string | boolean `

Ensures the app is starting with debugging

### port

Default: `9229`

Type: `number`

The port to inspect the process on. Setting port to 0 will assign random free ports to all forked processes.

### runtimeArgs

Type: `array`

Extra args passed to the node process

### waitUntilTargets

Type: `array`

The targets to run to before starting the node app

### watch

Default: `true`

Type: `boolean`

Run build when files change
