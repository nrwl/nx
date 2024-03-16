# Type alias: CreateDependencies\<T\>

Ƭ **CreateDependencies**\<`T`\>: (`options`: `T` \| `undefined`, `context`: [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext)) => [`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>

A function which parses files in the workspace to create dependencies in the [ProjectGraph](../../devkit/documents/ProjectGraph)
Use [validateDependency](../../devkit/documents/validateDependency) to validate dependencies

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`options`, `context`): [`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>

##### Parameters

| Name      | Type                                                                            |
| :-------- | :------------------------------------------------------------------------------ |
| `options` | `T` \| `undefined`                                                              |
| `context` | [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext) |

##### Returns

[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>
