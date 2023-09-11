# Type alias: StaticDependency

Ƭ **StaticDependency**: `Object`

A static [ProjectGraph](../../devkit/documents/ProjectGraph) dependency between 2 projects

This type of dependency indicates the source project ALWAYS load the target project.

NOTE: StaticDependency#sourceFile MUST be present unless the source is the name of a [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode)

#### Type declaration

| Name          | Type                                                            | Description                                                                                                                                                                                               |
| :------------ | :-------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`      | `string`                                                        | The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) or [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode) depending on the target project    |
| `sourceFile?` | `string`                                                        | The path of a file (relative from the workspace root) where the dependency is made                                                                                                                        |
| `target`      | `string`                                                        | The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) or [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode) that the source project depends on |
| `type`        | typeof [`static`](../../devkit/documents/DependencyType#static) | -                                                                                                                                                                                                         |
