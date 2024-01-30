# Interface: Task

A representation of the invocation of an Executor

## Table of contents

### Properties

- [cache](../../devkit/documents/Task#cache): boolean
- [endTime](../../devkit/documents/Task#endtime): number
- [hash](../../devkit/documents/Task#hash): string
- [hashDetails](../../devkit/documents/Task#hashdetails): Object
- [id](../../devkit/documents/Task#id): string
- [outputs](../../devkit/documents/Task#outputs): string[]
- [overrides](../../devkit/documents/Task#overrides): any
- [projectRoot](../../devkit/documents/Task#projectroot): string
- [startTime](../../devkit/documents/Task#starttime): number
- [target](../../devkit/documents/Task#target): Object

## Properties

### cache

• `Optional` **cache**: `boolean`

Determines if a given task should be cacheable.

---

### endTime

• `Optional` **endTime**: `number`

Unix timestamp of when a Batch Task ends

---

### hash

• `Optional` **hash**: `string`

Hash of the task which is used for caching.

---

### hashDetails

• `Optional` **hashDetails**: `Object`

Details about the composition of the hash

#### Type declaration

| Name            | Type                                 | Description                                                    |
| :-------------- | :----------------------------------- | :------------------------------------------------------------- |
| `command`       | `string`                             | Command of the task                                            |
| `implicitDeps?` | \{ `[fileName: string]`: `string`; } | Hashes of implicit dependencies which are included in the hash |
| `nodes`         | \{ `[name: string]`: `string`; }     | Hashes of inputs used in the hash                              |
| `runtime?`      | \{ `[input: string]`: `string`; }    | Hash of the runtime environment which the task was executed    |

---

### id

• **id**: `string`

Unique ID

---

### outputs

• **outputs**: `string`[]

The outputs the task may produce

---

### overrides

• **overrides**: `any`

Overrides for the configured options of the target

---

### projectRoot

• `Optional` **projectRoot**: `string`

Root of the project the task belongs to

---

### startTime

• `Optional` **startTime**: `number`

Unix timestamp of when a Batch Task starts

---

### target

• **target**: `Object`

Details about which project, target, and configuration to run.

#### Type declaration

| Name             | Type     | Description                                            |
| :--------------- | :------- | :----------------------------------------------------- |
| `configuration?` | `string` | The configuration of the target which the task invokes |
| `project`        | `string` | The project for which the task belongs to              |
| `target`         | `string` | The target name which the task should invoke           |
