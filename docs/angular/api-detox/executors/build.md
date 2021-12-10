---
title: '@nrwl/detox:build executor'
description: 'Run the command defined in build property of the specified configuration.'
---

# @nrwl/detox:build

Run the command defined in build property of the specified configuration.

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### configPath

Alias(es): cp

Type: `string`

Specify Detox config file path. If not supplied, detox searches for .detoxrc[.js] or "detox" section in package.json

### detoxConfiguration

Alias(es): C

Type: `string`

Select a device configuration from your defined configurations, if not supplied, and there's only one configuration, detox will default to it
