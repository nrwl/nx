# Function: readJson

▸ **readJson**\<`T`\>(`tree`, `path`, `options?`): `T`

Reads a json file, removes all comments and parses JSON.

#### Type parameters

| Name | Type                     |
| :--- | :----------------------- |
| `T`  | extends `object` = `any` |

#### Parameters

| Name       | Type                                                          | Description                 |
| :--------- | :------------------------------------------------------------ | :-------------------------- |
| `tree`     | [`Tree`](../../devkit/documents/Tree)                         | file system tree            |
| `path`     | `string`                                                      | file path                   |
| `options?` | [`JsonParseOptions`](../../devkit/documents/JsonParseOptions) | Optional JSON Parse Options |

#### Returns

`T`
