# Function: shareWorkspaceLibraries

▸ **shareWorkspaceLibraries**(`libraries`, `tsConfigPath?`): [`SharedWorkspaceLibraryConfig`](../../devkit/documents/SharedWorkspaceLibraryConfig)

Build an object of functions to be used with the ModuleFederationPlugin to
share Nx Workspace Libraries between Hosts and Remotes.

#### Parameters

| Name            | Type                                                            | Description                                                                  |
| :-------------- | :-------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| `libraries`     | [`WorkspaceLibrary`](../../devkit/documents/WorkspaceLibrary)[] | The Nx Workspace Libraries to share                                          |
| `tsConfigPath?` | `string`                                                        | The path to TS Config File that contains the Path Mappings for the Libraries |

#### Returns

[`SharedWorkspaceLibraryConfig`](../../devkit/documents/SharedWorkspaceLibraryConfig)
