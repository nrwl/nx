# Function: serializeJson

▸ **serializeJson**\<`T`\>(`input`, `options?`): `string`

Serializes the given data to a JSON string.
By default the JSON string is formatted with a 2 space indentation to be easy readable.

#### Type parameters

| Name | Type                        |
| :--- | :-------------------------- |
| `T`  | extends `object` = `object` |

#### Parameters

| Name       | Type                                                                                | Description                               |
| :--------- | :---------------------------------------------------------------------------------- | :---------------------------------------- |
| `input`    | `T`                                                                                 | Object which should be serialized to JSON |
| `options?` | [`JsonSerializeOptions`](/reference/core-api/devkit/documents/JsonSerializeOptions) | JSON serialize options                    |

#### Returns

`string`

the formatted JSON representation of the object
