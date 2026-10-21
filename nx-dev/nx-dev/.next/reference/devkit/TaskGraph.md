Graph of Tasks to be executed

## Table of contents

### Properties

- [continuousDependencies](/docs/reference/devkit/TaskGraph#continuousdependencies)
- [dependencies](/docs/reference/devkit/TaskGraph#dependencies)
- [roots](/docs/reference/devkit/TaskGraph#roots)
- [tasks](/docs/reference/devkit/TaskGraph#tasks)

## Properties

### continuousDependencies

• **continuousDependencies**: `Record`\<`string`, `string`[]\>

___

### dependencies

• **dependencies**: `Record`\<`string`, `string`[]\>

Map of Task IDs to IDs of tasks which the task depends on

___

### roots

• **roots**: `string`[]

IDs of Tasks which do not have any dependencies and are thus ready to execute immediately

___

### tasks

• **tasks**: `Record`\<`string`, [`Task`](/docs/reference/devkit/Task)\>

Map of Task IDs to Tasks
