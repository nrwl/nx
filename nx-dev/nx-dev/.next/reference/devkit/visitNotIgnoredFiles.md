▸ **visitNotIgnoredFiles**(`tree`, `dirPath`, `visitor`): `void`

Utility to act on all files in a tree that are not ignored by git.

Ignore files cascade, so a nested `.gitignore` covers the files under it and a
nested negation overrides the root. They are read from the tree, not disk, so
one a generator wrote in the same run counts.

`node_modules`, `.git` and the nx and yarn caches are never visited, whatever
the workspace's ignore files say.

#### Parameters

| Name | Type |
| :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) |
| `dirPath` | `string` |
| `visitor` | (`path`: `string`) => `void` |

#### Returns

`void`
