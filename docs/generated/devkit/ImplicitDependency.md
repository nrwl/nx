# Type alias: ImplicitDependency

Ƭ **ImplicitDependency**: `Object`

An implicit [ProjectGraph](../../devkit/documents/ProjectGraph) dependency between 2 projects

This type of dependency indicates a connection without an explicit reference in code

#### Type declaration

| Name     | Type                                                                | Description                                                                                                                |
| :------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------- |
| `source` | `string`                                                            | The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) depending on the target project    |
| `target` | `string`                                                            | The name of a [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) that the source project depends on |
| `type`   | typeof [`implicit`](../../devkit/documents/DependencyType#implicit) | -                                                                                                                          |
