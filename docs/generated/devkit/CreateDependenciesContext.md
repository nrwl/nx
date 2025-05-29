# Interface: CreateDependenciesContext

Context for [CreateDependencies](/reference/core-api/devkit/documents/CreateDependencies)

## Table of contents

### Properties

- [externalNodes](/reference/core-api/devkit/documents/CreateDependenciesContext#externalnodes): Record<string, ProjectGraphExternalNode>
- [fileMap](/reference/core-api/devkit/documents/CreateDependenciesContext#filemap): FileMap
- [filesToProcess](/reference/core-api/devkit/documents/CreateDependenciesContext#filestoprocess): FileMap
- [nxJsonConfiguration](/reference/core-api/devkit/documents/CreateDependenciesContext#nxjsonconfiguration): NxJsonConfiguration<string[] | "\*">
- [projects](/reference/core-api/devkit/documents/CreateDependenciesContext#projects): Record<string, ProjectConfiguration>
- [workspaceRoot](/reference/core-api/devkit/documents/CreateDependenciesContext#workspaceroot): string

## Properties

### externalNodes

• `Readonly` **externalNodes**: `Record`\<`string`, [`ProjectGraphExternalNode`](/reference/core-api/devkit/documents/ProjectGraphExternalNode)\>

The external nodes that have been added to the graph.

---

### fileMap

• `Readonly` **fileMap**: [`FileMap`](/reference/core-api/devkit/documents/FileMap)

All files in the workspace

---

### filesToProcess

• `Readonly` **filesToProcess**: [`FileMap`](/reference/core-api/devkit/documents/FileMap)

Files changes since last invocation

---

### nxJsonConfiguration

• `Readonly` **nxJsonConfiguration**: [`NxJsonConfiguration`](/reference/core-api/devkit/documents/NxJsonConfiguration)\<`string`[] \| `"*"`\>

The `nx.json` configuration from the workspace

---

### projects

• `Readonly` **projects**: `Record`\<`string`, [`ProjectConfiguration`](/reference/core-api/devkit/documents/ProjectConfiguration)\>

The configuration of each project in the workspace keyed by project name.

---

### workspaceRoot

• `Readonly` **workspaceRoot**: `string`
