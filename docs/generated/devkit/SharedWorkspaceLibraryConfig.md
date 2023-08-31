# Type alias: SharedWorkspaceLibraryConfig

Ƭ **SharedWorkspaceLibraryConfig**: `Object`

#### Type declaration

| Name                   | Type                                                                                                              |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `getAliases`           | () => `Record`<`string`, `string`\>                                                                               |
| `getLibraries`         | (`eager?`: `boolean`) => `Record`<`string`, [`SharedLibraryConfig`](../../devkit/documents/SharedLibraryConfig)\> |
| `getReplacementPlugin` | () => `NormalModuleReplacementPlugin`                                                                             |
