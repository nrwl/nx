# Type alias: CreateDependencies

Ƭ **CreateDependencies**: (`context`: [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext)) => [`ProjectGraphDependencyWithFile`](../../devkit/documents/ProjectGraphDependencyWithFile)[] \| `Promise`<[`ProjectGraphDependencyWithFile`](../../devkit/documents/ProjectGraphDependencyWithFile)[]\>

#### Type declaration

▸ (`context`): [`ProjectGraphDependencyWithFile`](../../devkit/documents/ProjectGraphDependencyWithFile)[] \| `Promise`<[`ProjectGraphDependencyWithFile`](../../devkit/documents/ProjectGraphDependencyWithFile)[]\>

A function which parses files in the workspace to create dependencies in the [ProjectGraph](../../devkit/documents/ProjectGraph)
Use [validateDependency](../../devkit/documents/validateDependency) to validate dependencies

##### Parameters

| Name      | Type                                                                            |
| :-------- | :------------------------------------------------------------------------------ |
| `context` | [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext) |

##### Returns

[`ProjectGraphDependencyWithFile`](../../devkit/documents/ProjectGraphDependencyWithFile)[] \| `Promise`<[`ProjectGraphDependencyWithFile`](../../devkit/documents/ProjectGraphDependencyWithFile)[]\>
