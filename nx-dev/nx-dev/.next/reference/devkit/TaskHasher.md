## Table of contents

### Methods

- [hashTask](/docs/reference/devkit/TaskHasher#hashtask)
- [hashTasks](/docs/reference/devkit/TaskHasher#hashtasks)

## Methods

### hashTask

▸ **hashTask**(`task`): `Promise`\<[`Hash`](/docs/reference/devkit/Hash)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `task` | [`Task`](/docs/reference/devkit/Task) |

#### Returns

`Promise`\<[`Hash`](/docs/reference/devkit/Hash)\>

**`Deprecated`**

use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20

▸ **hashTask**(`task`, `taskGraph`): `Promise`\<[`Hash`](/docs/reference/devkit/Hash)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `task` | [`Task`](/docs/reference/devkit/Task) |
| `taskGraph` | [`TaskGraph`](/docs/reference/devkit/TaskGraph) |

#### Returns

`Promise`\<[`Hash`](/docs/reference/devkit/Hash)\>

**`Deprecated`**

use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20

▸ **hashTask**(`task`, `taskGraph`, `env`, `cwd?`): `Promise`\<[`Hash`](/docs/reference/devkit/Hash)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `task` | [`Task`](/docs/reference/devkit/Task) |
| `taskGraph` | [`TaskGraph`](/docs/reference/devkit/TaskGraph) |
| `env` | `ProcessEnv` |
| `cwd?` | `string` |

#### Returns

`Promise`\<[`Hash`](/docs/reference/devkit/Hash)\>

___

### hashTasks

▸ **hashTasks**(`tasks`, `taskGraph`, `env`, `cwd?`): `Promise`\<[`Hash`](/docs/reference/devkit/Hash)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `tasks` | [`Task`](/docs/reference/devkit/Task)[] |
| `taskGraph` | [`TaskGraph`](/docs/reference/devkit/TaskGraph) |
| `env` | `ProcessEnv` |
| `cwd?` | `string` |

#### Returns

`Promise`\<[`Hash`](/docs/reference/devkit/Hash)[]\>

**`Deprecated`**

pass `perTaskEnvs` keyed by `task.id` instead — hashing
every task against one shared env produces the wrong cache key when
tasks have per-project/target `.env` files or custom hashers that
read env. Will be removed in v22.

▸ **hashTasks**(`tasks`, `taskGraph`, `perTaskEnvs`, `cwd?`): `Promise`\<[`Hash`](/docs/reference/devkit/Hash)[]\>

Hash `tasks`. `perTaskEnvs` must contain an entry keyed by `task.id`
for every task in `tasks` — task-specific env (per-project/target
`.env` files, custom-hasher env reads) participates in the hash, so
a shared env across tasks would compute the wrong cache key when
tasks actually differ.

#### Parameters

| Name | Type |
| :------ | :------ |
| `tasks` | [`Task`](/docs/reference/devkit/Task)[] |
| `taskGraph` | [`TaskGraph`](/docs/reference/devkit/TaskGraph) |
| `perTaskEnvs` | `Record`\<`string`, `ProcessEnv`\> |
| `cwd?` | `string` |

#### Returns

`Promise`\<[`Hash`](/docs/reference/devkit/Hash)[]\>
