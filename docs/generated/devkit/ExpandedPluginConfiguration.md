# Type alias: ExpandedPluginConfiguration\<T\>

Ƭ **ExpandedPluginConfiguration**\<`T`\>: `Object`

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

| Name       | Type       | Description                                                                                                      |
| :--------- | :--------- | :--------------------------------------------------------------------------------------------------------------- |
| `exclude?` | `string`[] | Glob patterns to exclude paths from the plugin's createNodes function.                                           |
| `include?` | `string`[] | Glob patterns to limit which paths the plugin's createNodes function will run on.                                |
| `options?` | `T`        | Configuration options for the loaded plugin                                                                      |
| `plugin`   | `string`   | The plugin module that should be loaded by Nx                                                                    |
| `version?` | `string`   | The version of the plugin to be installed by the Nx wrapper. If Nx is invoked from node_modules, this is unused. |
