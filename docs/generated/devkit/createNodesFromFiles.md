# Function: createNodesFromFiles

▸ **createNodesFromFiles**\<`T`\>(`createNodes`, `configFiles`, `options`, `context`): `Promise`\<[file: string, value: CreateNodesResult][]\>

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Parameters

| Name          | Type                                                                                                                                                                                                                                                                                                                                               |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createNodes` | (`projectConfigurationFile`: `string`, `options`: `T`, `context`: [`CreateNodesContext`](/reference/core-api/devkit/documents/CreateNodesContext), `idx`: `number`) => [`CreateNodesResult`](/reference/core-api/devkit/documents/CreateNodesResult) \| `Promise`\<[`CreateNodesResult`](/reference/core-api/devkit/documents/CreateNodesResult)\> |
| `configFiles` | readonly `string`[]                                                                                                                                                                                                                                                                                                                                |
| `options`     | `T`                                                                                                                                                                                                                                                                                                                                                |
| `context`     | [`CreateNodesContextV2`](/reference/core-api/devkit/documents/CreateNodesContextV2)                                                                                                                                                                                                                                                                |

#### Returns

`Promise`\<[file: string, value: CreateNodesResult][]\>
