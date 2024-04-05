# Type alias: Executor\<T\>

Ƭ **Executor**\<`T`\>: (`options`: `T`, `context`: [`ExecutorContext`](../../devkit/documents/ExecutorContext)) => `Promise`\<\{ `success`: `boolean` }\> \| `AsyncIterableIterator`\<\{ `success`: `boolean` }\>

Implementation of a target of a project

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`options`, `context`): `Promise`\<\{ `success`: `boolean` }\> \| `AsyncIterableIterator`\<\{ `success`: `boolean` }\>

##### Parameters

| Name      | Type                                                        |
| :-------- | :---------------------------------------------------------- |
| `options` | `T`                                                         |
| `context` | [`ExecutorContext`](../../devkit/documents/ExecutorContext) |

##### Returns

`Promise`\<\{ `success`: `boolean` }\> \| `AsyncIterableIterator`\<\{ `success`: `boolean` }\>
