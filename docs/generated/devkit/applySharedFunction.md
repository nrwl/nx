# Function: applySharedFunction

▸ **applySharedFunction**(`sharedConfig`, `sharedFn`): `void`

Apply a custom function provided by the user that will modify the Shared Config
of the dependencies for the Module Federation build.

#### Parameters

| Name           | Type                                                                                     | Description                               |
| :------------- | :--------------------------------------------------------------------------------------- | :---------------------------------------- |
| `sharedConfig` | `Record`<`string`, [`SharedLibraryConfig`](../../devkit/documents/SharedLibraryConfig)\> | The original Shared Config to be modified |
| `sharedFn`     | [`SharedFunction`](../../devkit/documents/SharedFunction)                                | The custom function to run                |

#### Returns

`void`
