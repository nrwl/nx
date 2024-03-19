# Type alias: Generator\<T\>

Ƭ **Generator**\<`T`\>: (`tree`: `any`, `schema`: `T`) => `void` \| [`GeneratorCallback`](../../devkit/documents/GeneratorCallback) \| `Promise`\<`void` \| [`GeneratorCallback`](../../devkit/documents/GeneratorCallback)\>

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`tree`, `schema`): `void` \| [`GeneratorCallback`](../../devkit/documents/GeneratorCallback) \| `Promise`\<`void` \| [`GeneratorCallback`](../../devkit/documents/GeneratorCallback)\>

A function that schedules updates to the filesystem to be done atomically

##### Parameters

| Name     | Type  |
| :------- | :---- |
| `tree`   | `any` |
| `schema` | `T`   |

##### Returns

`void` \| [`GeneratorCallback`](../../devkit/documents/GeneratorCallback) \| `Promise`\<`void` \| [`GeneratorCallback`](../../devkit/documents/GeneratorCallback)\>
