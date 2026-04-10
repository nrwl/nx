# Interface: ExecutorContext

Context that is passed into an executor

## Table of contents

### Properties

- [configurationName](../../devkit/documents/ExecutorContext#configurationname): string
- [cwd](../../devkit/documents/ExecutorContext#cwd): string
- [isVerbose](../../devkit/documents/ExecutorContext#isverbose): boolean
- [nxJsonConfiguration](../../devkit/documents/ExecutorContext#nxjsonconfiguration): NxJsonConfiguration<string[] | "\*">
- [projectGraph](../../devkit/documents/ExecutorContext#projectgraph): ProjectGraph
- [projectName](../../devkit/documents/ExecutorContext#projectname): string
- [projectsConfigurations](../../devkit/documents/ExecutorContext#projectsconfigurations): ProjectsConfigurations
- [root](../../devkit/documents/ExecutorContext#root): string
- [target](../../devkit/documents/ExecutorContext#target): TargetConfiguration<any>
- [targetName](../../devkit/documents/ExecutorContext#targetname): string
- [taskGraph](../../devkit/documents/ExecutorContext#taskgraph): TaskGraph

## Properties

### configurationName

• `Optional` **configurationName**: `string`

The name of the configuration being executed

---

### cwd

• **cwd**: `string`

The current working directory

---

### isVerbose

• **isVerbose**: `boolean`

Enable verbose logging

---

### nxJsonConfiguration

• **nxJsonConfiguration**: [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)\<`string`[] \| `"*"`\>

The contents of nx.json.

---

### projectGraph

• **projectGraph**: [`ProjectGraph`](../../devkit/documents/ProjectGraph)

A snapshot of the project graph as
it existed when the Nx command was kicked off

---

### projectName

• `Optional` **projectName**: `string`

The name of the project being executed on

---

### projectsConfigurations

• **projectsConfigurations**: [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

Projects config

---

### root

• **root**: `string`

The root of the workspace

---

### target

• `Optional` **target**: [`TargetConfiguration`](../../devkit/documents/TargetConfiguration)\<`any`\>

The configuration of the target being executed

---

### targetName

• `Optional` **targetName**: `string`

The name of the target being executed

---

### taskGraph

• `Optional` **taskGraph**: [`TaskGraph`](../../devkit/documents/TaskGraph)

A snapshot of the task graph as
it existed when the Nx command was kicked off
