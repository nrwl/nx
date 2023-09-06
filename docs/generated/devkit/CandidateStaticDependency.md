# Type alias: CandidateStaticDependency

Ƭ **CandidateStaticDependency**: `Object`

A [ProjectGraph](../../devkit/documents/ProjectGraph) dependency between 2 projects

NOTE: CandidateStaticDependency#sourceFile is required if the dependency is
between 2 project nodes. It is only optional if the dependency references an external
node as its source.

#### Type declaration

| Name          | Type                                                            | Description                                                                                                                                                                                               |
| :------------ | :-------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`      | `string`                                                        | The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) or [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode) depending on the target project    |
| `sourceFile?` | `string`                                                        | The path of a file (relative from the workspace root) where the dependency is made                                                                                                                        |
| `target`      | `string`                                                        | The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) or [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode) that the source project depends on |
| `type`        | typeof [`static`](../../devkit/documents/DependencyType#static) | -                                                                                                                                                                                                         |
