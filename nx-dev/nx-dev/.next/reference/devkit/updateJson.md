▸ **updateJson**\<`T`, `U`\>(`tree`, `path`, `updater`, `options?`): `void`

Updates a JSON value to the file system tree

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `object` = `any` |
| `U` | extends `object` = `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | File system tree |
| `path` | `string` | Path of JSON file in the Tree |
| `updater` | (`value`: `T`) => `U` | Function that maps the current value of a JSON document to a new value to be written to the document |
| `options?` | [`JsonParseOptions`](/docs/reference/devkit/JsonParseOptions) & [`JsonSerializeOptions`](/docs/reference/devkit/JsonSerializeOptions) | Optional JSON Parse and Serialize Options |

#### Returns

`void`
