# Type alias: CreateDependencies<T\>

Ƭ **CreateDependencies**<`T`\>: (`context`: [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext), `pluginConfig`: `T`) => [`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>

#### Type parameters

| Name | Type                                                                    |
| :--- | :---------------------------------------------------------------------- |
| `T`  | extends `Record`<`string`, `unknown`\> = `Record`<`string`, `unknown`\> |

#### Type declaration

▸ (`context`, `pluginConfig`): [`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>

A function which parses files in the workspace to create dependencies in the [ProjectGraph](../../devkit/documents/ProjectGraph)
Use [validateDependency](../../devkit/documents/validateDependency) to validate dependencies

##### Parameters

| Name           | Type                                                                            |
| :------------- | :------------------------------------------------------------------------------ |
| `context`      | [`CreateDependenciesContext`](../../devkit/documents/CreateDependenciesContext) |
| `pluginConfig` | `T`                                                                             |

##### Returns

[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[] \| `Promise`<[`RawProjectGraphDependency`](../../devkit/documents/RawProjectGraphDependency)[]\>
