# Type alias: Generator\<T\>

Ƭ **Generator**\<`T`\>: (`tree`: `any`, `schema`: `T`) => `void` \| [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback) \| `Promise`\<`void` \| [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)\>

A function that schedules updates to the filesystem to be done atomically

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`tree`, `schema`): `void` \| [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback) \| `Promise`\<`void` \| [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)\>

##### Parameters

| Name     | Type  |
| :------- | :---- |
| `tree`   | `any` |
| `schema` | `T`   |

##### Returns

`void` \| [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback) \| `Promise`\<`void` \| [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)\>
