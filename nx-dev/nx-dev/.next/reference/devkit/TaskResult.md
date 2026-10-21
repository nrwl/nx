The result of a completed Task.

Task timing information (start and end timestamps) is available
on the Task object itself via `Task.startTime` and `Task.endTime`.

## Table of contents

### Properties

- [code](/docs/reference/devkit/TaskResult#code)
- [status](/docs/reference/devkit/TaskResult#status)
- [task](/docs/reference/devkit/TaskResult#task)
- [terminalOutput](/docs/reference/devkit/TaskResult#terminaloutput)

## Properties

### code

• **code**: `number`

___

### status

• **status**: ``"success"`` \| ``"failure"`` \| ``"skipped"`` \| ``"stopped"`` \| ``"local-cache-kept-existing"`` \| ``"local-cache"`` \| ``"remote-cache"``

___

### task

• **task**: [`Task`](/docs/reference/devkit/Task)

___

### terminalOutput

• `Optional` **terminalOutput**: `string`
