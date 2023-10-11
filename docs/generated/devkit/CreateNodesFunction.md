# Type alias: CreateNodesFunction<T\>

Ƭ **CreateNodesFunction**<`T`\>: (`projectConfigurationFile`: `string`, `context`: [`CreateNodesContext`](../../devkit/documents/CreateNodesContext), `pluginConfiguration`: `T`) => { `externalNodes?`: `Record`<`string`, [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode)\> ; `projects?`: `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\> }

#### Type parameters

| Name | Type                                                                    |
| :--- | :---------------------------------------------------------------------- |
| `T`  | extends `Record`<`string`, `unknown`\> = `Record`<`string`, `unknown`\> |

#### Type declaration

▸ (`projectConfigurationFile`, `context`, `pluginConfiguration`): `Object`

A function which parses a configuration file into a set of nodes.
Used for creating nodes for the [ProjectGraph](../../devkit/documents/ProjectGraph)

##### Parameters

| Name                       | Type                                                              |
| :------------------------- | :---------------------------------------------------------------- |
| `projectConfigurationFile` | `string`                                                          |
| `context`                  | [`CreateNodesContext`](../../devkit/documents/CreateNodesContext) |
| `pluginConfiguration`      | `T`                                                               |

##### Returns

`Object`

| Name             | Type                                                                                               |
| :--------------- | :------------------------------------------------------------------------------------------------- |
| `externalNodes?` | `Record`<`string`, [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode)\> |
| `projects?`      | `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>         |
