# Function: formatFiles

▸ **formatFiles**(`tree`, `options?`): `Promise`\<`void`\>

Formats all the created or updated files using Prettier

#### Parameters

| Name                             | Type                                                | Description                          |
| :------------------------------- | :-------------------------------------------------- | :----------------------------------- |
| `tree`                           | [`Tree`](/reference/core-api/devkit/documents/Tree) | the file system tree                 |
| `options?`                       | `Object`                                            | options for the formatFiles function |
| `options.sortRootTsconfigPaths?` | `boolean`                                           | -                                    |

#### Returns

`Promise`\<`void`\>
