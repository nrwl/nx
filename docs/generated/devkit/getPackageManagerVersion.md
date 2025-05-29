# Function: getPackageManagerVersion

▸ **getPackageManagerVersion**(`packageManager?`, `cwd?`): `string`

Returns the version of the package manager used in the workspace.
By default, the package manager is derived based on the lock file,
but it can also be passed in explicitly.

#### Parameters

| Name             | Type                                                                    |
| :--------------- | :---------------------------------------------------------------------- |
| `packageManager` | [`PackageManager`](/reference/core-api/devkit/documents/PackageManager) |
| `cwd`            | `string`                                                                |

#### Returns

`string`
