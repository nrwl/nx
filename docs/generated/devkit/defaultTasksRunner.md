# Function: defaultTasksRunner

▸ **defaultTasksRunner**(`tasks`, `options`, `context?`): `any`

`any | Promise<{ [id: string]: TaskStatus }>`
will change to Promise<{ [id: string]: TaskStatus }> after Nx 15 is released.

#### Parameters

| Name                         | Type                                                                                       |
| :--------------------------- | :----------------------------------------------------------------------------------------- |
| `tasks`                      | [`Task`](../../devkit/documents/Task)[]                                                    |
| `options`                    | [`DefaultTasksRunnerOptions`](../../devkit/documents/DefaultTasksRunnerOptions)            |
| `context?`                   | `Object`                                                                                   |
| `context.daemon?`            | `DaemonClient`                                                                             |
| `context.hasher?`            | [`TaskHasher`](../../devkit/documents/TaskHasher)                                          |
| `context.initiatingProject?` | `string`                                                                                   |
| `context.nxArgs`             | `NxArgs`                                                                                   |
| `context.nxJson`             | [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)\<`string`[] \| `"*"`\> |
| `context.projectGraph`       | [`ProjectGraph`](../../devkit/documents/ProjectGraph)                                      |
| `context.target?`            | `string`                                                                                   |
| `context.taskGraph?`         | [`TaskGraph`](../../devkit/documents/TaskGraph)                                            |

#### Returns

`any`
