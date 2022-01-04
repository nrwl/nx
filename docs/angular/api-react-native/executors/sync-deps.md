---
title: '@nrwl/react-native:sync-deps executor'
description: 'Syncs dependencies to package.json (required for autolinking).'
---

# @nrwl/react-native:sync-deps

Syncs dependencies to package.json (required for autolinking).

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Options

### include

Type: `string`

A comma-separated list of additional npm packages to include. e.g. 'nx sync-deps --include=react-native-gesture-handler,react-native-safe-area-context'
