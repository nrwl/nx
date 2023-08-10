# Interface: Task

A representation of the invocation of an Executor

## Table of contents

### Properties

- [endTime](../../devkit/documents/Task#endtime)
- [hash](../../devkit/documents/Task#hash)
- [hashDetails](../../devkit/documents/Task#hashdetails)
- [id](../../devkit/documents/Task#id)
- [overrides](../../devkit/documents/Task#overrides)
- [projectRoot](../../devkit/documents/Task#projectroot)
- [startTime](../../devkit/documents/Task#starttime)
- [target](../../devkit/documents/Task#target)

## Properties

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

| Name            | Type                                | Description                                                    |
| :-------------- | :---------------------------------- | :------------------------------------------------------------- |
| `command`       | `string`                            | Command of the task                                            |
| `implicitDeps?` | { `[fileName: string]`: `string`; } | Hashes of implicit dependencies which are included in the hash |
| `nodes`         | { `[name: string]`: `string`; }     | Hashes of inputs used in the hash                              |
| `runtime?`      | { `[input: string]`: `string`; }    | Hash of the runtime environment which the task was executed    |

---

### id

• **id**: `string`

Unique ID

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
