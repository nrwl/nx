Ƭ **ImplicitDependency**: `Object`

An implicit [ProjectGraph](/docs/reference/devkit/ProjectGraph) dependency between 2 projects

This type of dependency indicates a connection without an explicit reference in code

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `source` | `string` | The name of a [ProjectGraphProjectNode](/docs/reference/devkit/ProjectGraphProjectNode) depending on the target project |
| `target` | `string` | The name of a [ProjectGraphProjectNode](/docs/reference/devkit/ProjectGraphProjectNode) that the source project depends on |
| `type` | typeof [`implicit`](/docs/reference/devkit/DependencyType#implicit) | - |
