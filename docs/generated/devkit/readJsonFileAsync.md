# Function: readJsonFileAsync

▸ **readJsonFileAsync**\<`T`\>(`path`, `options?`): `Promise`\<`T`\>

Reads a JSON file asynchronously and returns the object the JSON content represents.

#### Type parameters

| Name | Type                     |
| :--- | :----------------------- |
| `T`  | extends `object` = `any` |

#### Parameters

| Name       | Type              | Description        |
| :--------- | :---------------- | :----------------- |
| `path`     | `string`          | A path to a file.  |
| `options?` | `JsonReadOptions` | JSON parse options |

#### Returns

`Promise`\<`T`\>

Object the JSON content of the file represents
