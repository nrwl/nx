# Interface: Task

A representation of the invocation of an Executor

## Table of contents

### Properties

- [cache](/reference/core-api/devkit/documents/Task#cache): boolean
- [continuous](/reference/core-api/devkit/documents/Task#continuous): boolean
- [endTime](/reference/core-api/devkit/documents/Task#endtime): number
- [hash](/reference/core-api/devkit/documents/Task#hash): string
- [hashDetails](/reference/core-api/devkit/documents/Task#hashdetails): Object
- [id](/reference/core-api/devkit/documents/Task#id): string
- [outputs](/reference/core-api/devkit/documents/Task#outputs): string[]
- [overrides](/reference/core-api/devkit/documents/Task#overrides): any
- [parallelism](/reference/core-api/devkit/documents/Task#parallelism): boolean
- [projectRoot](/reference/core-api/devkit/documents/Task#projectroot): string
- [startTime](/reference/core-api/devkit/documents/Task#starttime): number
- [target](/reference/core-api/devkit/documents/Task#target): Object

## Properties

### cache

• `Optional` **cache**: `boolean`

Determines if a given task should be cacheable.

---

### continuous

• `Optional` **continuous**: `boolean`

This denotes if the task runs continuously

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

### parallelism

• **parallelism**: `boolean`

Determines if a given task should be parallelizable.

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
