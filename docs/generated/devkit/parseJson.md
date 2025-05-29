# Function: parseJson

▸ **parseJson**\<`T`\>(`input`, `options?`): `T`

Parses the given JSON string and returns the object the JSON content represents.
By default javascript-style comments and trailing commas are allowed.

#### Type parameters

| Name | Type                     |
| :--- | :----------------------- |
| `T`  | extends `object` = `any` |

#### Parameters

| Name       | Type                                                                        | Description            |
| :--------- | :-------------------------------------------------------------------------- | :--------------------- |
| `input`    | `string`                                                                    | JSON content as string |
| `options?` | [`JsonParseOptions`](/reference/core-api/devkit/documents/JsonParseOptions) | JSON parse options     |

#### Returns

`T`

Object the JSON content represents
