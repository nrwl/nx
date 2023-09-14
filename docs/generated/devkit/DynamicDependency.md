# Type alias: DynamicDependency

Ƭ **DynamicDependency**: `Object`

A dynamic [ProjectGraph](../../devkit/documents/ProjectGraph) dependency between 2 projects

This type of dependency indicates the source project MAY OR MAY NOT load the target project.

#### Type declaration

| Name         | Type                                                              | Description                                                                                                                |
| :----------- | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `source`     | `string`                                                          | The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) depending on the target project    |
| `sourceFile` | `string`                                                          | The path of a file (relative from the workspace root) where the dependency is made                                         |
| `target`     | `string`                                                          | The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) that the source project depends on |
| `type`       | typeof [`dynamic`](../../devkit/documents/DependencyType#dynamic) | -                                                                                                                          |
