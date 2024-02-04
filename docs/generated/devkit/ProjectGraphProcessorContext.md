# Interface: ProjectGraphProcessorContext

Additional information to be used to process a project graph

**`Deprecated`**

The ProjectGraphProcessor is deprecated. This will be removed in Nx 19.

## Table of contents

### Properties

- [fileMap](../../devkit/documents/ProjectGraphProcessorContext#filemap): ProjectFileMap
- [filesToProcess](../../devkit/documents/ProjectGraphProcessorContext#filestoprocess): ProjectFileMap
- [nxJsonConfiguration](../../devkit/documents/ProjectGraphProcessorContext#nxjsonconfiguration): NxJsonConfiguration<string[] | "\*">
- [projectsConfigurations](../../devkit/documents/ProjectGraphProcessorContext#projectsconfigurations): ProjectsConfigurations
- [workspace](../../devkit/documents/ProjectGraphProcessorContext#workspace): Workspace

## Properties

### fileMap

• **fileMap**: [`ProjectFileMap`](../../devkit/documents/ProjectFileMap)

All files in the workspace

---

### filesToProcess

• **filesToProcess**: [`ProjectFileMap`](../../devkit/documents/ProjectFileMap)

Files changes since last invocation

---

### nxJsonConfiguration

• **nxJsonConfiguration**: [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)\<`string`[] \| `"*"`\>

---

### projectsConfigurations

• **projectsConfigurations**: [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

---

### workspace

• **workspace**: [`Workspace`](../../devkit/documents/Workspace)

Workspace information such as projects and configuration

**`Deprecated`**

use [projectsConfigurations](../../devkit/documents/ProjectGraphProcessorContext#projectsconfigurations) or [nxJsonConfiguration](../../devkit/documents/ProjectGraphProcessorContext#nxjsonconfiguration) instead
