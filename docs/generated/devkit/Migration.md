# Type alias: Migration

Ƭ **Migration**: (`tree`: [`Tree`](/reference/core-api/devkit/documents/Tree)) => `void` \| `Promise`\<`void`\> \| `string`[] \| `Promise`\<`string`[]\>

Represents a migration that is executed when running `nx migrate`.

Returning a string[] from the migration function will be interpreted as
a list of next steps to be displayed to the user.

#### Type declaration

▸ (`tree`): `void` \| `Promise`\<`void`\> \| `string`[] \| `Promise`\<`string`[]\>

##### Parameters

| Name   | Type                                                |
| :----- | :-------------------------------------------------- |
| `tree` | [`Tree`](/reference/core-api/devkit/documents/Tree) |

##### Returns

`void` \| `Promise`\<`void`\> \| `string`[] \| `Promise`\<`string`[]\>
