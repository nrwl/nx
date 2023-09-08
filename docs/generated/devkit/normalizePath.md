# Function: normalizePath

▸ **normalizePath**(`osSpecificPath`): `string`

Coverts an os specific path to a unix style path. Use this when writing paths to config files.
This should not be used to read files on disk because of the removal of Windows drive letters.

#### Parameters

| Name             | Type     |
| :--------------- | :------- |
| `osSpecificPath` | `string` |

#### Returns

`string`
