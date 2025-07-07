# Interface: ExecutorContext

Context that is passed into an executor

## Table of contents

### Properties

- [configurationName](/reference/core-api/devkit/documents/ExecutorContext#configurationname): string
- [cwd](/reference/core-api/devkit/documents/ExecutorContext#cwd): string
- [isVerbose](/reference/core-api/devkit/documents/ExecutorContext#isverbose): boolean
- [nxJsonConfiguration](/reference/core-api/devkit/documents/ExecutorContext#nxjsonconfiguration): NxJsonConfiguration<string[] | "\*">
- [projectGraph](/reference/core-api/devkit/documents/ExecutorContext#projectgraph): ProjectGraph
- [projectName](/reference/core-api/devkit/documents/ExecutorContext#projectname): string
- [projectsConfigurations](/reference/core-api/devkit/documents/ExecutorContext#projectsconfigurations): ProjectsConfigurations
- [root](/reference/core-api/devkit/documents/ExecutorContext#root): string
- [target](/reference/core-api/devkit/documents/ExecutorContext#target): TargetConfiguration<any>
- [targetName](/reference/core-api/devkit/documents/ExecutorContext#targetname): string
- [taskGraph](/reference/core-api/devkit/documents/ExecutorContext#taskgraph): TaskGraph

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

• **nxJsonConfiguration**: [`NxJsonConfiguration`](/reference/core-api/devkit/documents/NxJsonConfiguration)\<`string`[] \| `"*"`\>

The contents of nx.json.

---

### projectGraph

• **projectGraph**: [`ProjectGraph`](/reference/core-api/devkit/documents/ProjectGraph)

A snapshot of the project graph as
it existed when the Nx command was kicked off

---

### projectName

• `Optional` **projectName**: `string`

The name of the project being executed on

---

### projectsConfigurations

• **projectsConfigurations**: [`ProjectsConfigurations`](/reference/core-api/devkit/documents/ProjectsConfigurations)

Projects config

---

### root

• **root**: `string`

The root of the workspace

---

### target

• `Optional` **target**: [`TargetConfiguration`](/reference/core-api/devkit/documents/TargetConfiguration)\<`any`\>

The configuration of the target being executed

---

### targetName

• `Optional` **targetName**: `string`

The name of the target being executed

---

### taskGraph

• `Optional` **taskGraph**: [`TaskGraph`](/reference/core-api/devkit/documents/TaskGraph)

A snapshot of the task graph as
it existed when the Nx command was kicked off
