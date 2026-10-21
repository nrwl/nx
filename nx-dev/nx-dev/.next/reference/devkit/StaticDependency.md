Ƭ **StaticDependency**: `Object`

A static [ProjectGraph](/docs/reference/devkit/ProjectGraph) dependency between 2 projects

This type of dependency indicates the source project ALWAYS load the target project.

NOTE: StaticDependency#sourceFile MUST be present unless the source is the name of a [ProjectGraphExternalNode](/docs/reference/devkit/ProjectGraphExternalNode)

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `source` | `string` | The name of a [ProjectGraphProjectNode](/docs/reference/devkit/ProjectGraphProjectNode) or [ProjectGraphExternalNode](/docs/reference/devkit/ProjectGraphExternalNode) depending on the target project |
| `sourceFile?` | `string` | The path of a file (relative from the workspace root) where the dependency is made |
| `target` | `string` | The name of a [ProjectGraphProjectNode](/docs/reference/devkit/ProjectGraphProjectNode) or [ProjectGraphExternalNode](/docs/reference/devkit/ProjectGraphExternalNode) that the source project depends on |
| `type` | typeof [`static`](/docs/reference/devkit/DependencyType#static) | - |
