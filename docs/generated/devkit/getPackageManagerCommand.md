# Function: getPackageManagerCommand

▸ **getPackageManagerCommand**(`packageManager?`, `root?`): `PackageManagerCommands`

Returns commands for the package manager used in the workspace.
By default, the package manager is derived based on the lock file,
but it can also be passed in explicitly.

Example:

```javascript
execSync(`${getPackageManagerCommand().addDev} my-dev-package`);
```

#### Parameters

| Name              | Type                                                                    | Description                                                                                 |
| :---------------- | :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| `packageManager?` | [`PackageManager`](/reference/core-api/devkit/documents/PackageManager) | The package manager to use. If not provided, it will be detected based on the lock file.    |
| `root?`           | `string`                                                                | The directory the commands will be ran inside of. Defaults to the current workspace's root. |

#### Returns

`PackageManagerCommands`
