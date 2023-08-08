# Interface: NxPlugin

A plugin for Nx

## Table of contents

### Properties

- [name](../../devkit/documents/NxPlugin#name)
- [processProjectGraph](../../devkit/documents/NxPlugin#processprojectgraph)
- [projectFilePatterns](../../devkit/documents/NxPlugin#projectfilepatterns)
- [registerProjectTargets](../../devkit/documents/NxPlugin#registerprojecttargets)

## Properties

### name

• **name**: `string`

---

### processProjectGraph

• `Optional` **processProjectGraph**: `ProjectGraphProcessor`

---

### projectFilePatterns

• `Optional` **projectFilePatterns**: `string`[]

A glob pattern to search for non-standard project files.
@example: ["*.csproj", "pom.xml"]

---

### registerProjectTargets

• `Optional` **registerProjectTargets**: [`ProjectTargetConfigurator`](../../devkit/documents/ProjectTargetConfigurator)
