# Interface: CreateDependenciesContext

Context for [CreateDependencies](../../devkit/documents/CreateDependencies)

## Table of contents

### Properties

- [fileMap](../../devkit/documents/CreateDependenciesContext#filemap): ProjectFileMap
- [filesToProcess](../../devkit/documents/CreateDependenciesContext#filestoprocess): ProjectFileMap
- [graph](../../devkit/documents/CreateDependenciesContext#graph): ProjectGraph
- [nxJsonConfiguration](../../devkit/documents/CreateDependenciesContext#nxjsonconfiguration): NxJsonConfiguration&lt;string[] | &quot;\*&quot;&gt;
- [projectsConfigurations](../../devkit/documents/CreateDependenciesContext#projectsconfigurations): ProjectsConfigurations

## Properties

### fileMap

• `Readonly` **fileMap**: [`ProjectFileMap`](../../devkit/documents/ProjectFileMap)

All files in the workspace

---

### filesToProcess

• `Readonly` **filesToProcess**: [`ProjectFileMap`](../../devkit/documents/ProjectFileMap)

Files changes since last invocation

---

### graph

• `Readonly` **graph**: [`ProjectGraph`](../../devkit/documents/ProjectGraph)

The current project graph,

---

### nxJsonConfiguration

• `Readonly` **nxJsonConfiguration**: [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)<`string`[] \| `"*"`\>

The `nx.json` configuration from the workspace

---

### projectsConfigurations

• `Readonly` **projectsConfigurations**: [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

The configuration of each project in the workspace
