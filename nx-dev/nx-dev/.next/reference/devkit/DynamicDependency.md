Ƭ **DynamicDependency**: `Object`

A dynamic [ProjectGraph](/docs/reference/devkit/ProjectGraph) dependency between 2 projects

This type of dependency indicates the source project MAY OR MAY NOT load the target project.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `source` | `string` | The name of a [ProjectGraphProjectNode](/docs/reference/devkit/ProjectGraphProjectNode) depending on the target project |
| `sourceFile` | `string` | The path of a file (relative from the workspace root) where the dependency is made |
| `target` | `string` | The name of a [ProjectGraphProjectNode](/docs/reference/devkit/ProjectGraphProjectNode) that the source project depends on |
| `type` | typeof [`dynamic`](/docs/reference/devkit/DependencyType#dynamic) | - |
