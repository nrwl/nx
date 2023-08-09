# Type alias: CreateDependencies

Ƭ **CreateDependencies**: (`context`: [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext)) => `ProjectGraphDependencyWithFile`[] \| `Promise`<`ProjectGraphDependencyWithFile`[]\>

#### Type declaration

▸ (`context`): `ProjectGraphDependencyWithFile`[] \| `Promise`<`ProjectGraphDependencyWithFile`[]\>

A function which parses files in the workspace to create dependencies in the [ProjectGraph](../../devkit/documents/ProjectGraph)
Use validateDependency to validate dependencies

##### Parameters

| Name      | Type                                                                            |
| :-------- | :------------------------------------------------------------------------------ |
| `context` | [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext) |

##### Returns

`ProjectGraphDependencyWithFile`[] \| `Promise`<`ProjectGraphDependencyWithFile`[]\>
