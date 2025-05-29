# Type alias: CreateNodesFunction\<T\>

Ƭ **CreateNodesFunction**\<`T`\>: (`projectConfigurationFile`: `string`, `options`: `T` \| `undefined`, `context`: [`CreateNodesContext`](/reference/core-api/devkit/documents/CreateNodesContext)) => [`CreateNodesResult`](/reference/core-api/devkit/documents/CreateNodesResult) \| `Promise`\<[`CreateNodesResult`](/reference/core-api/devkit/documents/CreateNodesResult)\>

A function which parses a configuration file into a set of nodes.
Used for creating nodes for the [ProjectGraph](/reference/core-api/devkit/documents/ProjectGraph)

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`projectConfigurationFile`, `options`, `context`): [`CreateNodesResult`](/reference/core-api/devkit/documents/CreateNodesResult) \| `Promise`\<[`CreateNodesResult`](/reference/core-api/devkit/documents/CreateNodesResult)\>

##### Parameters

| Name                       | Type                                                                            |
| :------------------------- | :------------------------------------------------------------------------------ |
| `projectConfigurationFile` | `string`                                                                        |
| `options`                  | `T` \| `undefined`                                                              |
| `context`                  | [`CreateNodesContext`](/reference/core-api/devkit/documents/CreateNodesContext) |

##### Returns

[`CreateNodesResult`](/reference/core-api/devkit/documents/CreateNodesResult) \| `Promise`\<[`CreateNodesResult`](/reference/core-api/devkit/documents/CreateNodesResult)\>
