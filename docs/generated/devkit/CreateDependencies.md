# Type alias: CreateDependencies

Ƭ **CreateDependencies**: (`context`: [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext)) => [`CandidateDependency`](../../devkit/documents/CandidateDependency)[] \| `Promise`<[`CandidateDependency`](../../devkit/documents/CandidateDependency)[]\>

#### Type declaration

▸ (`context`): [`CandidateDependency`](../../devkit/documents/CandidateDependency)[] \| `Promise`<[`CandidateDependency`](../../devkit/documents/CandidateDependency)[]\>

A function which parses files in the workspace to create dependencies in the [ProjectGraph](../../devkit/documents/ProjectGraph)
Use [validateDependency](../../devkit/documents/validateDependency) to validate dependencies

##### Parameters

| Name      | Type                                                                            |
| :-------- | :------------------------------------------------------------------------------ |
| `context` | [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext) |

##### Returns

[`CandidateDependency`](../../devkit/documents/CandidateDependency)[] \| `Promise`<[`CandidateDependency`](../../devkit/documents/CandidateDependency)[]\>
