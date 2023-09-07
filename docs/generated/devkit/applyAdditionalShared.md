# Function: applyAdditionalShared

▸ **applyAdditionalShared**(`sharedConfig`, `additionalShared`, `projectGraph`): `void`

Add additional dependencies to the shared package that may not have been
discovered by the project graph.

This can be useful for applications that use a Dependency Injection system
that expects certain Singleton values to be present in the shared injection
hierarchy.

#### Parameters

| Name               | Type                                                                                     | Description                        |
| :----------------- | :--------------------------------------------------------------------------------------- | :--------------------------------- |
| `sharedConfig`     | `Record`<`string`, [`SharedLibraryConfig`](../../devkit/documents/SharedLibraryConfig)\> | The original Shared Config         |
| `additionalShared` | [`AdditionalSharedConfig`](../../devkit/documents/AdditionalSharedConfig)                | The additional dependencies to add |
| `projectGraph`     | [`ProjectGraph`](../../devkit/documents/ProjectGraph)                                    | The Nx project graph               |

#### Returns

`void`
