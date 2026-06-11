Context for [CreateDependencies](/docs/reference/devkit/CreateDependencies)

## Table of contents

### Properties

- [externalNodes](/docs/reference/devkit/CreateDependenciesContext#externalnodes)
- [fileMap](/docs/reference/devkit/CreateDependenciesContext#filemap)
- [filesToProcess](/docs/reference/devkit/CreateDependenciesContext#filestoprocess)
- [nxJsonConfiguration](/docs/reference/devkit/CreateDependenciesContext#nxjsonconfiguration)
- [projects](/docs/reference/devkit/CreateDependenciesContext#projects)
- [workspaceRoot](/docs/reference/devkit/CreateDependenciesContext#workspaceroot)

## Properties

### externalNodes

• `Readonly` **externalNodes**: `Record`\<`string`, [`ProjectGraphExternalNode`](/docs/reference/devkit/ProjectGraphExternalNode)\>

The external nodes that have been added to the graph.

___

### fileMap

• `Readonly` **fileMap**: [`FileMap`](/docs/reference/devkit/FileMap)

All files in the workspace

___

### filesToProcess

• `Readonly` **filesToProcess**: [`FileMap`](/docs/reference/devkit/FileMap)

Files changes since last invocation

___

### nxJsonConfiguration

• `Readonly` **nxJsonConfiguration**: [`NxJsonConfiguration`](/docs/reference/devkit/NxJsonConfiguration)\<`string`[] \| ``"*"``\>

The `nx.json` configuration from the workspace

___

### projects

• `Readonly` **projects**: `Record`\<`string`, [`ProjectConfiguration`](/docs/reference/devkit/ProjectConfiguration)\>

The configuration of each project in the workspace keyed by project name.

___

### workspaceRoot

• `Readonly` **workspaceRoot**: `string`
