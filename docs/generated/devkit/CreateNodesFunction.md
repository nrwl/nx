# Type alias: CreateNodesFunction\<T\>

Ƭ **CreateNodesFunction**\<`T`\>: (`projectConfigurationFile`: `string`, `options`: `T` \| `undefined`, `context`: [`CreateNodesContext`](../../devkit/documents/CreateNodesContext)) => [`CreateNodesResult`](../../devkit/documents/CreateNodesResult) \| `Promise`\<[`CreateNodesResult`](../../devkit/documents/CreateNodesResult)\>

A function which parses a configuration file into a set of nodes.
Used for creating nodes for the [ProjectGraph](../../devkit/documents/ProjectGraph)

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`projectConfigurationFile`, `options`, `context`): [`CreateNodesResult`](../../devkit/documents/CreateNodesResult) \| `Promise`\<[`CreateNodesResult`](../../devkit/documents/CreateNodesResult)\>

##### Parameters

| Name                       | Type                                                              |
| :------------------------- | :---------------------------------------------------------------- |
| `projectConfigurationFile` | `string`                                                          |
| `options`                  | `T` \| `undefined`                                                |
| `context`                  | [`CreateNodesContext`](../../devkit/documents/CreateNodesContext) |

##### Returns

[`CreateNodesResult`](../../devkit/documents/CreateNodesResult) \| `Promise`\<[`CreateNodesResult`](../../devkit/documents/CreateNodesResult)\>
