# Interface: TaskHasher

## Table of contents

### Methods

- [hashTask](../../devkit/documents/TaskHasher#hashtask)
- [hashTasks](../../devkit/documents/TaskHasher#hashtasks)

## Methods

### hashTask

▸ **hashTask**(`task`): `Promise`<[`Hash`](../../devkit/documents/Hash)\>

**`Deprecated`**

use hashTask(task:Task, taskGraph: TaskGraph)

#### Parameters

| Name   | Type                                  |
| :----- | :------------------------------------ |
| `task` | [`Task`](../../devkit/documents/Task) |

#### Returns

`Promise`<[`Hash`](../../devkit/documents/Hash)\>

▸ **hashTask**(`task`, `taskGraph`): `Promise`<[`Hash`](../../devkit/documents/Hash)\>

#### Parameters

| Name        | Type                                            |
| :---------- | :---------------------------------------------- |
| `task`      | [`Task`](../../devkit/documents/Task)           |
| `taskGraph` | [`TaskGraph`](../../devkit/documents/TaskGraph) |

#### Returns

`Promise`<[`Hash`](../../devkit/documents/Hash)\>

---

### hashTasks

▸ **hashTasks**(`tasks`): `Promise`<[`Hash`](../../devkit/documents/Hash)[]\>

**`Deprecated`**

use hashTasks(tasks:Task[], taskGraph: TaskGraph)

#### Parameters

| Name    | Type                                    |
| :------ | :-------------------------------------- |
| `tasks` | [`Task`](../../devkit/documents/Task)[] |

#### Returns

`Promise`<[`Hash`](../../devkit/documents/Hash)[]\>

▸ **hashTasks**(`tasks`, `taskGraph`): `Promise`<[`Hash`](../../devkit/documents/Hash)[]\>

#### Parameters

| Name        | Type                                            |
| :---------- | :---------------------------------------------- |
| `tasks`     | [`Task`](../../devkit/documents/Task)[]         |
| `taskGraph` | [`TaskGraph`](../../devkit/documents/TaskGraph) |

#### Returns

`Promise`<[`Hash`](../../devkit/documents/Hash)[]\>
