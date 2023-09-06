# Function: mapRemotesForSSR

▸ **mapRemotesForSSR**(`remotes`, `remoteEntryExt`, `determineRemoteUrl`): `Record`<`string`, `string`\>

Map remote names to a format that can be understood and used by Module
Federation.

#### Parameters

| Name                 | Type                                        | Description                                              |
| :------------------- | :------------------------------------------ | :------------------------------------------------------- |
| `remotes`            | [`Remotes`](../../devkit/documents/Remotes) | The remotes to map                                       |
| `remoteEntryExt`     | `"js"` \| `"mjs"`                           | The file extension of the remoteEntry file               |
| `determineRemoteUrl` | (`remote`: `string`) => `string`            | The function used to lookup the URL of the served remote |

#### Returns

`Record`<`string`, `string`\>
