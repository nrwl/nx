# Function: writeJsonFileAsync

▸ **writeJsonFileAsync**\<`T`\>(`path`, `data`, `options?`): `Promise`\<`void`\>

Serializes the given data to JSON and writes it to a file asynchronously.

#### Type parameters

| Name | Type                        |
| :--- | :-------------------------- |
| `T`  | extends `object` = `object` |

#### Parameters

| Name       | Type               | Description                                                     |
| :--------- | :----------------- | :-------------------------------------------------------------- |
| `path`     | `string`           | A path to a file.                                               |
| `data`     | `T`                | data which should be serialized to JSON and written to the file |
| `options?` | `JsonWriteOptions` | JSON serialize options                                          |

#### Returns

`Promise`\<`void`\>
