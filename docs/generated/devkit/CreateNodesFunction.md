# Type alias: CreateNodesFunction<T\>

Ƭ **CreateNodesFunction**<`T`\>: (`projectConfigurationFile`: `string`, `options`: `T` \| `undefined`, `context`: [`CreateNodesContext`](../../devkit/documents/CreateNodesContext)) => { `externalNodes?`: `Record`<`string`, [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode)\> ; `projects?`: `Record`<`string`, `Optional`<[`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration), `"root"`\>\> }

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

| Name             | Type                                                                                                              | Description                                                                                                |
| :--------------- | :---------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `externalNodes?` | `Record`<`string`, [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode)\>                | A map of external node name -> external node. External nodes do not have a root, so the key is their name. |
| `projects?`      | `Record`<`string`, `Optional`<[`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration), `"root"`\>\> | A map of project root -> project configuration                                                             |
