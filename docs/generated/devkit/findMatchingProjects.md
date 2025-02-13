# Function: findMatchingProjects

▸ **findMatchingProjects**(`patterns?`, `projects`): `string`[]

Find matching project names given a list of potential project names or globs.

#### Parameters

| Name       | Type                                                                                              | Default value | Description                                                                                         |
| :--------- | :------------------------------------------------------------------------------------------------ | :------------ | :-------------------------------------------------------------------------------------------------- |
| `patterns` | `string`[]                                                                                        | `[]`          | A list of project names or globs to match against.                                                  |
| `projects` | `Record`\<`string`, [`ProjectGraphProjectNode`](../../devkit/documents/ProjectGraphProjectNode)\> | `undefined`   | A map of [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode) by project name. |

#### Returns

`string`[]
