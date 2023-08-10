# Function: getDependentPackagesForProject

▸ **getDependentPackagesForProject**(`projectGraph`, `name`): `Object`

#### Parameters

| Name           | Type                                                  |
| :------------- | :---------------------------------------------------- |
| `projectGraph` | [`ProjectGraph`](../../devkit/documents/ProjectGraph) |
| `name`         | `string`                                              |

#### Returns

`Object`

| Name                 | Type                                                            |
| :------------------- | :-------------------------------------------------------------- |
| `npmPackages`        | `string`[]                                                      |
| `workspaceLibraries` | [`WorkspaceLibrary`](../../devkit/documents/WorkspaceLibrary)[] |
