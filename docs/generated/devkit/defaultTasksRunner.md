# Function: defaultTasksRunner

▸ **defaultTasksRunner**(`tasks`, `options`, `context?`): `any`

#### Parameters

| Name                         | Type                                                                                                     |
| :--------------------------- | :------------------------------------------------------------------------------------------------------- |
| `tasks`                      | [`Task`](/reference/core-api/devkit/documents/Task)[]                                                    |
| `options`                    | [`DefaultTasksRunnerOptions`](/reference/core-api/devkit/documents/DefaultTasksRunnerOptions)            |
| `context?`                   | `Object`                                                                                                 |
| `context.daemon?`            | `DaemonClient`                                                                                           |
| `context.hasher?`            | [`TaskHasher`](/reference/core-api/devkit/documents/TaskHasher)                                          |
| `context.initiatingProject?` | `string`                                                                                                 |
| `context.initiatingTasks`    | [`Task`](/reference/core-api/devkit/documents/Task)[]                                                    |
| `context.nxArgs`             | `NxArgs`                                                                                                 |
| `context.nxJson`             | [`NxJsonConfiguration`](/reference/core-api/devkit/documents/NxJsonConfiguration)\<`string`[] \| `"*"`\> |
| `context.projectGraph`       | [`ProjectGraph`](/reference/core-api/devkit/documents/ProjectGraph)                                      |
| `context.target?`            | `string`                                                                                                 |
| `context.taskGraph?`         | [`TaskGraph`](/reference/core-api/devkit/documents/TaskGraph)                                            |

#### Returns

`any`
