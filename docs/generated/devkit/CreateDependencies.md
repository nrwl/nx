# Type alias: CreateDependencies\<T\>

Ƭ **CreateDependencies**\<`T`\>: (`options`: `T` \| `undefined`, `context`: [`CreateDependenciesContext`](/reference/core-api/devkit/documents/CreateDependenciesContext)) => [`RawProjectGraphDependency`](/reference/core-api/devkit/documents/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](/reference/core-api/devkit/documents/RawProjectGraphDependency)[]\>

A function which parses files in the workspace to create dependencies in the [ProjectGraph](/reference/core-api/devkit/documents/ProjectGraph)
Use [validateDependency](/reference/core-api/devkit/documents/validateDependency) to validate dependencies

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`options`, `context`): [`RawProjectGraphDependency`](/reference/core-api/devkit/documents/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](/reference/core-api/devkit/documents/RawProjectGraphDependency)[]\>

##### Parameters

| Name      | Type                                                                                          |
| :-------- | :-------------------------------------------------------------------------------------------- |
| `options` | `T` \| `undefined`                                                                            |
| `context` | [`CreateDependenciesContext`](/reference/core-api/devkit/documents/CreateDependenciesContext) |

##### Returns

[`RawProjectGraphDependency`](/reference/core-api/devkit/documents/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](/reference/core-api/devkit/documents/RawProjectGraphDependency)[]\>
