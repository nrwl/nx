The data type that `nx graph --file graph.json` or `nx build --graph graph.json` contains

## Table of contents

### Properties

- [graph](/docs/reference/devkit/GraphJson#graph)
- [taskPlans](/docs/reference/devkit/GraphJson#taskplans)
- [tasks](/docs/reference/devkit/GraphJson#tasks)

## Properties

### graph

• **graph**: [`ProjectGraph`](/docs/reference/devkit/ProjectGraph)

The project graph

___

### taskPlans

• `Optional` **taskPlans**: `Record`\<`string`, `string`[]\>

The plans for hashing a task in the task graph

___

### tasks

• `Optional` **tasks**: [`TaskGraph`](/docs/reference/devkit/TaskGraph)

A graph of tasks populated with `nx build --graph`
