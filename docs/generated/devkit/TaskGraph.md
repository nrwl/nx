# Interface: TaskGraph

Graph of Tasks to be executed

## Table of contents

### Properties

- [dependencies](../../devkit/documents/TaskGraph#dependencies): Record<string, string[]>
- [roots](../../devkit/documents/TaskGraph#roots): string[]
- [tasks](../../devkit/documents/TaskGraph#tasks): Record<string, Task>

## Properties

### dependencies

• **dependencies**: `Record`\<`string`, `string`[]\>

Map of Task IDs to IDs of tasks which the task depends on

---

### roots

• **roots**: `string`[]

IDs of Tasks which do not have any dependencies and are thus ready to execute immediately

---

### tasks

• **tasks**: `Record`\<`string`, [`Task`](../../devkit/documents/Task)\>

Map of Task IDs to Tasks
