# Type alias: CreateNodesFunction<T\>

Ƭ **CreateNodesFunction**<`T`\>: (`projectConfigurationFile`: `string`, `options`: `T` \| `undefined`, `context`: [`CreateNodesContext`](../../devkit/documents/CreateNodesContext)) => { `externalNodes?`: `Record`<`string`, [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode)\> ; `projects?`: `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\> }

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`projectConfigurationFile`, `options`, `context`): `Object`

A function which parses a configuration file into a set of nodes.
Used for creating nodes for the [ProjectGraph](../../devkit/documents/ProjectGraph)

##### Parameters

| Name                       | Type                                                              |
| :------------------------- | :---------------------------------------------------------------- |
| `projectConfigurationFile` | `string`                                                          |
| `options`                  | `T` \| `undefined`                                                |
| `context`                  | [`CreateNodesContext`](../../devkit/documents/CreateNodesContext) |

##### Returns

`Object`

| Name             | Type                                                                                               |
| :--------------- | :------------------------------------------------------------------------------------------------- |
| `externalNodes?` | `Record`<`string`, [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode)\> |
| `projects?`      | `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>         |
