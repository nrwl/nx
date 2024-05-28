# Type alias: BeforeCreateNodes\<T\>

Ƭ **BeforeCreateNodes**\<`T`\>: (`options`: `T` \| `undefined`, `context`: `BeforeCreateNodesContext`) => `void` \| `Promise`\<`void`\>

A function which is called before the create nodes function is called.
Useful for reading from cache or other setup.

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`options`, `context`): `void` \| `Promise`\<`void`\>

##### Parameters

| Name      | Type                       |
| :-------- | :------------------------- |
| `options` | `T` \| `undefined`         |
| `context` | `BeforeCreateNodesContext` |

##### Returns

`void` \| `Promise`\<`void`\>
