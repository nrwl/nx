Context that is passed into an executor

## Table of contents

### Properties

- [configurationName](/docs/reference/devkit/ExecutorContext#configurationname)
- [cwd](/docs/reference/devkit/ExecutorContext#cwd)
- [isVerbose](/docs/reference/devkit/ExecutorContext#isverbose)
- [nxJsonConfiguration](/docs/reference/devkit/ExecutorContext#nxjsonconfiguration)
- [projectGraph](/docs/reference/devkit/ExecutorContext#projectgraph)
- [projectName](/docs/reference/devkit/ExecutorContext#projectname)
- [projectsConfigurations](/docs/reference/devkit/ExecutorContext#projectsconfigurations)
- [root](/docs/reference/devkit/ExecutorContext#root)
- [target](/docs/reference/devkit/ExecutorContext#target)
- [targetName](/docs/reference/devkit/ExecutorContext#targetname)
- [taskGraph](/docs/reference/devkit/ExecutorContext#taskgraph)

## Properties

### configurationName

• `Optional` **configurationName**: `string`

The name of the configuration being executed

___

### cwd

• **cwd**: `string`

The current working directory

___

### isVerbose

• **isVerbose**: `boolean`

Enable verbose logging

___

### nxJsonConfiguration

• **nxJsonConfiguration**: [`NxJsonConfiguration`](/docs/reference/devkit/NxJsonConfiguration)\<`string`[] \| ``"*"``\>

The contents of nx.json.

___

### projectGraph

• **projectGraph**: [`ProjectGraph`](/docs/reference/devkit/ProjectGraph)

A snapshot of the project graph as
it existed when the Nx command was kicked off

___

### projectName

• `Optional` **projectName**: `string`

The name of the project being executed on

___

### projectsConfigurations

• **projectsConfigurations**: [`ProjectsConfigurations`](/docs/reference/devkit/ProjectsConfigurations)

Projects config

___

### root

• **root**: `string`

The root of the workspace

___

### target

• `Optional` **target**: [`TargetConfiguration`](/docs/reference/devkit/TargetConfiguration)\<`any`\>

The configuration of the target being executed

___

### targetName

• `Optional` **targetName**: `string`

The name of the target being executed

___

### taskGraph

• `Optional` **taskGraph**: [`TaskGraph`](/docs/reference/devkit/TaskGraph)

A snapshot of the task graph as
it existed when the Nx command was kicked off
