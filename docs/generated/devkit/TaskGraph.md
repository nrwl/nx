# Interface: TaskGraph

Graph of Tasks to be executed

## Table of contents

### Properties

- [continueOnFailureDependencies](/reference/core-api/devkit/documents/TaskGraph#continueonfailuredependencies): Record<string, string[]>
- [continuousDependencies](/reference/core-api/devkit/documents/TaskGraph#continuousdependencies): Record<string, string[]>
- [dependencies](/reference/core-api/devkit/documents/TaskGraph#dependencies): Record<string, string[]>
- [roots](/reference/core-api/devkit/documents/TaskGraph#roots): string[]
- [tasks](/reference/core-api/devkit/documents/TaskGraph#tasks): Record<string, Task>

## Properties

### continueOnFailureDependencies

• **continueOnFailureDependencies**: `Record`\<`string`, `string`[]\>

Map of Task IDs to IDs of dependency tasks that, when failed, will not prevent the task from executing

---

### continuousDependencies

• **continuousDependencies**: `Record`\<`string`, `string`[]\>

---

### dependencies

• **dependencies**: `Record`\<`string`, `string`[]\>

Map of Task IDs to IDs of tasks which the task depends on

---

### roots

• **roots**: `string`[]

IDs of Tasks which do not have any dependencies and are thus ready to execute immediately

---

### tasks

• **tasks**: `Record`\<`string`, [`Task`](/reference/core-api/devkit/documents/Task)\>

Map of Task IDs to Tasks
