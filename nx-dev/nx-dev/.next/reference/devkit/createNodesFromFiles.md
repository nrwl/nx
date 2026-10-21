▸ **createNodesFromFiles**\<`T`\>(`createNodes`, `configFiles`, `options`, `context`): `Promise`\<[file: string, value: CreateNodesResult][]\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `unknown` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `createNodes` | (`projectConfigurationFile`: `string`, `options`: `T`, `context`: [`CreateNodesContext`](/docs/reference/devkit/CreateNodesContext) & \{ `configFiles`: readonly `string`[]  }, `idx`: `number`) => [`CreateNodesResult`](/docs/reference/devkit/CreateNodesResult) \| `Promise`\<[`CreateNodesResult`](/docs/reference/devkit/CreateNodesResult)\> |
| `configFiles` | readonly `string`[] |
| `options` | `T` |
| `context` | [`CreateNodesContext`](/docs/reference/devkit/CreateNodesContext) |

#### Returns

`Promise`\<[file: string, value: CreateNodesResult][]\>
