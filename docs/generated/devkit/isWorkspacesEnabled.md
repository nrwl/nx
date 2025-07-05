# Function: isWorkspacesEnabled

▸ **isWorkspacesEnabled**(`packageManager?`, `root?`): `boolean`

Returns true if the workspace is using npm workspaces, yarn workspaces, or pnpm workspaces.

#### Parameters

| Name              | Type                                                                    | Description                                                                                 |
| :---------------- | :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| `packageManager?` | [`PackageManager`](/reference/core-api/devkit/documents/PackageManager) | The package manager to use. If not provided, it will be detected based on the lock file.    |
| `root?`           | `string`                                                                | The directory the commands will be ran inside of. Defaults to the current workspace's root. |

#### Returns

`boolean`
