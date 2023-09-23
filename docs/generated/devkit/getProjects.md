# Function: getProjects

▸ **getProjects**(`tree`): `Map`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>

Get a map of all projects in a workspace.

Use [readProjectConfiguration](../../devkit/documents/readProjectConfiguration) if only one project is needed.

#### Parameters

| Name   | Type                                  |
| :----- | :------------------------------------ |
| `tree` | [`Tree`](../../devkit/documents/Tree) |

#### Returns

`Map`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>

**`Deprecated`**

This method will be removed in Nx v18. It's usefulness is a bit hampered from including non-project.json projects which are not updateable. It also has never been truly accurate, and projects that are identified which do not contain a project.json or package.json file have never been returned. Use a combination of [getProjectJsonProjects](../../devkit/documents/getProjectJsonProjects) and [glob](../../devkit/documents/glob) instead to find the projects you wish to update.
