# Function: formatFiles

▸ **formatFiles**(`tree`, `options?`): `Promise`\<`void`\>

Formats all the created or updated files using Prettier

#### Parameters

| Name                            | Type                                                     | Description                                                                                                                                                |
| :------------------------------ | :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tree`                          | [`Tree`](../../reference/core-api/devkit/documents/Tree) | the file system tree                                                                                                                                       |
| `options?`                      | `Object`                                                 | -                                                                                                                                                          |
| `options.sortRootTsconfigPaths` | `boolean`                                                | TODO(v21): Stop sorting tsconfig paths by default, paths are now less common/important in Nx workspace setups, and the sorting causes comments to be lost. |

#### Returns

`Promise`\<`void`\>
