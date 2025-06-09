# Function: writeJson

▸ **writeJson**\<`T`\>(`tree`, `path`, `value`, `options?`): `void`

Writes a JSON value to the file system tree

#### Type parameters

| Name | Type                        |
| :--- | :-------------------------- |
| `T`  | extends `object` = `object` |

#### Parameters

| Name       | Type                                                                                | Description                     |
| :--------- | :---------------------------------------------------------------------------------- | :------------------------------ |
| `tree`     | [`Tree`](/reference/core-api/devkit/documents/Tree)                                 | File system tree                |
| `path`     | `string`                                                                            | Path of JSON file in the Tree   |
| `value`    | `T`                                                                                 | Serializable value to write     |
| `options?` | [`JsonSerializeOptions`](/reference/core-api/devkit/documents/JsonSerializeOptions) | Optional JSON Serialize Options |

#### Returns

`void`
