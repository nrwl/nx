Ƭ **CreateDependencies**\<`T`\>: (`options`: `T` \| `undefined`, `context`: [`CreateDependenciesContext`](/docs/reference/devkit/CreateDependenciesContext)) => [`RawProjectGraphDependency`](/docs/reference/devkit/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](/docs/reference/devkit/RawProjectGraphDependency)[]\>

A function which parses files in the workspace to create dependencies in the [ProjectGraph](/docs/reference/devkit/ProjectGraph)
Use [validateDependency](/docs/reference/devkit/validateDependency) to validate dependencies

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `unknown` |

#### Type declaration

▸ (`options`, `context`): [`RawProjectGraphDependency`](/docs/reference/devkit/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](/docs/reference/devkit/RawProjectGraphDependency)[]\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `options` | `T` \| `undefined` |
| `context` | [`CreateDependenciesContext`](/docs/reference/devkit/CreateDependenciesContext) |

##### Returns

[`RawProjectGraphDependency`](/docs/reference/devkit/RawProjectGraphDependency)[] \| `Promise`\<[`RawProjectGraphDependency`](/docs/reference/devkit/RawProjectGraphDependency)[]\>
