# Function: getNpmPackageSharedConfig

▸ **getNpmPackageSharedConfig**(`pkgName`, `version`): [`SharedLibraryConfig`](../../devkit/documents/SharedLibraryConfig) \| `undefined`

Build the Module Federation Share Config for a specific package and the
specified version of that package.

#### Parameters

| Name      | Type     | Description                                                                    |
| :-------- | :------- | :----------------------------------------------------------------------------- |
| `pkgName` | `string` | Name of the package to share                                                   |
| `version` | `string` | Version of the package to require by other apps in the Module Federation setup |

#### Returns

[`SharedLibraryConfig`](../../devkit/documents/SharedLibraryConfig) \| `undefined`
