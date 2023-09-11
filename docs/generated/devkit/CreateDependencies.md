# Type alias: CreateDependencies

Ƭ **CreateDependencies**: (`context`: [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext)) => [`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>

#### Type declaration

▸ (`context`): [`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>

A function which parses files in the workspace to create dependencies in the [ProjectGraph](../../devkit/documents/ProjectGraph)
Use [validateDependency](../../devkit/documents/validateDependency) to validate dependencies

##### Parameters

| Name      | Type                                                                            |
| :-------- | :------------------------------------------------------------------------------ |
| `context` | [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext) |

##### Returns

[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>
