# Interface: ProjectGraphDependencyWithFile

A [ProjectGraph](../../devkit/documents/ProjectGraph) dependency between 2 projects
Optional: Specifies a file from where the dependency is made

## Table of contents

### Properties

- [dependencyType](../../devkit/documents/ProjectGraphDependencyWithFile#dependencytype): DependencyType
- [source](../../devkit/documents/ProjectGraphDependencyWithFile#source): string
- [sourceFile](../../devkit/documents/ProjectGraphDependencyWithFile#sourcefile): string
- [target](../../devkit/documents/ProjectGraphDependencyWithFile#target): string

## Properties

### dependencyType

• **dependencyType**: [`DependencyType`](../../devkit/documents/DependencyType)

The type of dependency

---

### source

• **source**: `string`

The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) or [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode) depending on the target project

---

### sourceFile

• `Optional` **sourceFile**: `string`

The path of a file (relative from the workspace root) where the dependency is made

---

### target

• **target**: `string`

The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) or [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode) that the source project depends on
