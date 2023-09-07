# Function: joinPathFragments

▸ **joinPathFragments**(`...fragments`): `string`

Normalized path fragments and joins them. Use this when writing paths to config files.
This should not be used to read files on disk because of the removal of Windows drive letters.

#### Parameters

| Name           | Type       |
| :------------- | :--------- |
| `...fragments` | `string`[] |

#### Returns

`string`
