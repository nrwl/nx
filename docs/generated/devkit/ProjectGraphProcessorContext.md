# Interface: ProjectGraphProcessorContext

Additional information to be used to process a project graph

## Table of contents

### Properties

- [fileMap](../../devkit/documents/ProjectGraphProcessorContext#filemap)
- [filesToProcess](../../devkit/documents/ProjectGraphProcessorContext#filestoprocess)
- [nxJsonConfiguration](../../devkit/documents/ProjectGraphProcessorContext#nxjsonconfiguration)
- [projectsConfigurations](../../devkit/documents/ProjectGraphProcessorContext#projectsconfigurations)
- [workspace](../../devkit/documents/ProjectGraphProcessorContext#workspace)

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

• **nxJsonConfiguration**: [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)<`string`[] \| `"*"`\>

---

### projectsConfigurations

• **projectsConfigurations**: [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

---

### workspace

• **workspace**: [`Workspace`](../../devkit/documents/Workspace)

Workspace information such as projects and configuration

**`Deprecated`**

use [projectsConfigurations](../../devkit/documents/ProjectGraphProcessorContext#projectsconfigurations) or [nxJsonConfiguration](../../devkit/documents/ProjectGraphProcessorContext#nxjsonconfiguration) instead
