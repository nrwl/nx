▸ **writeJson**\<`T`\>(`tree`, `path`, `value`, `options?`): `void`

Writes a JSON value to the file system tree

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends `object` = `object` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | File system tree |
| `path` | `string` | Path of JSON file in the Tree |
| `value` | `T` | Serializable value to write |
| `options?` | [`JsonSerializeOptions`](/docs/reference/devkit/JsonSerializeOptions) | Optional JSON Serialize Options |

#### Returns

`void`
