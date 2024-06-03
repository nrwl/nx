# Function: createNodesFromFiles

▸ **createNodesFromFiles**\<`T`\>(`createNodes`, `configFiles`, `options`, `context`): `Promise`\<[file: string, value: CreateNodesResult][]\>

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Parameters

| Name          | Type                                                                       |
| :------------ | :------------------------------------------------------------------------- |
| `createNodes` | [`CreateNodesFunction`](../../devkit/documents/CreateNodesFunction)\<`T`\> |
| `configFiles` | readonly `string`[]                                                        |
| `options`     | `T`                                                                        |
| `context`     | [`CreateNodesContextV2`](../../devkit/documents/CreateNodesContextV2)      |

#### Returns

`Promise`\<[file: string, value: CreateNodesResult][]\>
