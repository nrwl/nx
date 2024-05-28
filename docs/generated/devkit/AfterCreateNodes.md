# Type alias: AfterCreateNodes\<T\>

Ƭ **AfterCreateNodes**\<`T`\>: (`options`: `T` \| `undefined`, `context`: `AfterCreateNodesContext`) => `void` \| `Promise`\<`void`\>

A function which is called after the create nodes function is called.
Useful for writing to cache or other cleanup.

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`options`, `context`): `void` \| `Promise`\<`void`\>

##### Parameters

| Name      | Type                      |
| :-------- | :------------------------ |
| `options` | `T` \| `undefined`        |
| `context` | `AfterCreateNodesContext` |

##### Returns

`void` \| `Promise`\<`void`\>
