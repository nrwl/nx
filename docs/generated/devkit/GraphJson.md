# Interface: GraphJson

The data type that `nx graph --file graph.json` or `nx build --graph graph.json` contains

## Table of contents

### Properties

- [graph](../../devkit/documents/GraphJson#graph): ProjectGraph
- [taskPlans](../../devkit/documents/GraphJson#taskplans): Record<string, string[]>
- [tasks](../../devkit/documents/GraphJson#tasks): TaskGraph

## Properties

### graph

• **graph**: [`ProjectGraph`](../../devkit/documents/ProjectGraph)

The project graph

---

### taskPlans

• `Optional` **taskPlans**: `Record`\<`string`, `string`[]\>

The plans for hashing a task in the task graph

---

### tasks

• `Optional` **tasks**: [`TaskGraph`](../../devkit/documents/TaskGraph)

A graph of tasks populated with `nx build --graph`
