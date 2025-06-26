# Function: visitNotIgnoredFiles

▸ **visitNotIgnoredFiles**(`tree`, `dirPath?`, `visitor`): `void`

Utility to act on all files in a tree that are not ignored by git.

#### Parameters

| Name      | Type                                                | Default value |
| :-------- | :-------------------------------------------------- | :------------ |
| `tree`    | [`Tree`](/reference/core-api/devkit/documents/Tree) | `undefined`   |
| `dirPath` | `string`                                            | `tree.root`   |
| `visitor` | (`path`: `string`) => `void`                        | `undefined`   |

#### Returns

`void`
