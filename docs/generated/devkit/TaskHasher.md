# Interface: TaskHasher

## Table of contents

### Methods

- [hashTask](/reference/core-api/devkit/documents/TaskHasher#hashtask)
- [hashTasks](/reference/core-api/devkit/documents/TaskHasher#hashtasks)

## Methods

### hashTask

▸ **hashTask**(`task`): `Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)\>

#### Parameters

| Name   | Type                                                |
| :----- | :-------------------------------------------------- |
| `task` | [`Task`](/reference/core-api/devkit/documents/Task) |

#### Returns

`Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)\>

**`Deprecated`**

use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20

▸ **hashTask**(`task`, `taskGraph`): `Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)\>

#### Parameters

| Name        | Type                                                          |
| :---------- | :------------------------------------------------------------ |
| `task`      | [`Task`](/reference/core-api/devkit/documents/Task)           |
| `taskGraph` | [`TaskGraph`](/reference/core-api/devkit/documents/TaskGraph) |

#### Returns

`Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)\>

**`Deprecated`**

use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20

▸ **hashTask**(`task`, `taskGraph`, `env`): `Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)\>

#### Parameters

| Name        | Type                                                          |
| :---------- | :------------------------------------------------------------ |
| `task`      | [`Task`](/reference/core-api/devkit/documents/Task)           |
| `taskGraph` | [`TaskGraph`](/reference/core-api/devkit/documents/TaskGraph) |
| `env`       | `ProcessEnv`                                                  |

#### Returns

`Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)\>

---

### hashTasks

▸ **hashTasks**(`tasks`): `Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)[]\>

#### Parameters

| Name    | Type                                                  |
| :------ | :---------------------------------------------------- |
| `tasks` | [`Task`](/reference/core-api/devkit/documents/Task)[] |

#### Returns

`Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)[]\>

**`Deprecated`**

use hashTasks(tasks:Task[], taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20

▸ **hashTasks**(`tasks`, `taskGraph`): `Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)[]\>

#### Parameters

| Name        | Type                                                          |
| :---------- | :------------------------------------------------------------ |
| `tasks`     | [`Task`](/reference/core-api/devkit/documents/Task)[]         |
| `taskGraph` | [`TaskGraph`](/reference/core-api/devkit/documents/TaskGraph) |

#### Returns

`Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)[]\>

**`Deprecated`**

use hashTasks(tasks:Task[], taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20

▸ **hashTasks**(`tasks`, `taskGraph`, `env`): `Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)[]\>

#### Parameters

| Name        | Type                                                          |
| :---------- | :------------------------------------------------------------ |
| `tasks`     | [`Task`](/reference/core-api/devkit/documents/Task)[]         |
| `taskGraph` | [`TaskGraph`](/reference/core-api/devkit/documents/TaskGraph) |
| `env`       | `ProcessEnv`                                                  |

#### Returns

`Promise`\<[`Hash`](/reference/core-api/devkit/documents/Hash)[]\>
