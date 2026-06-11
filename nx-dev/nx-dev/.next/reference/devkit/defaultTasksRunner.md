▸ **defaultTasksRunner**(`tasks`, `options`, `context?`): `any`

#### Parameters

| Name | Type |
| :------ | :------ |
| `tasks` | [`Task`](/docs/reference/devkit/Task)[] |
| `options` | [`DefaultTasksRunnerOptions`](/docs/reference/devkit/DefaultTasksRunnerOptions) |
| `context?` | `Object` |
| `context.daemon?` | `DaemonClient` |
| `context.hasher?` | [`TaskHasher`](/docs/reference/devkit/TaskHasher) |
| `context.initiatingProject?` | `string` |
| `context.initiatingTasks` | [`Task`](/docs/reference/devkit/Task)[] |
| `context.nxArgs` | `NxArgs` |
| `context.nxJson` | [`NxJsonConfiguration`](/docs/reference/devkit/NxJsonConfiguration)\<`string`[] \| ``"*"``\> |
| `context.projectGraph` | [`ProjectGraph`](/docs/reference/devkit/ProjectGraph) |
| `context.target?` | `string` |
| `context.taskGraph?` | [`TaskGraph`](/docs/reference/devkit/TaskGraph) |

#### Returns

`any`
