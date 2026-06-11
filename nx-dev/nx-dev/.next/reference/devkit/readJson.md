▸ **readJson**\<`T`\>(`tree`, `path`, `options?`): `T`

Reads a json file, removes all comments and parses JSON.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `object` = `any` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | file system tree |
| `path` | `string` | file path |
| `options?` | [`JsonParseOptions`](/docs/reference/devkit/JsonParseOptions) | Optional JSON Parse Options |

#### Returns

`T`
