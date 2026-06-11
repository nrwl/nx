A representation of the invocation of an Executor

## Table of contents

### Properties

- [cache](/docs/reference/devkit/Task#cache)
- [continuous](/docs/reference/devkit/Task#continuous)
- [endTime](/docs/reference/devkit/Task#endtime)
- [hash](/docs/reference/devkit/Task#hash)
- [hashDetails](/docs/reference/devkit/Task#hashdetails)
- [id](/docs/reference/devkit/Task#id)
- [outputs](/docs/reference/devkit/Task#outputs)
- [overrides](/docs/reference/devkit/Task#overrides)
- [parallelism](/docs/reference/devkit/Task#parallelism)
- [projectRoot](/docs/reference/devkit/Task#projectroot)
- [startTime](/docs/reference/devkit/Task#starttime)
- [target](/docs/reference/devkit/Task#target)

## Properties

### cache

• `Optional` **cache**: `boolean`

Determines if a given task should be cacheable.

___

### continuous

• `Optional` **continuous**: `boolean`

This denotes if the task runs continuously

___

### endTime

• `Optional` **endTime**: `number`

Unix timestamp of when a Batch Task ends

___

### hash

• `Optional` **hash**: `string`

Hash of the task which is used for caching.

___

### hashDetails

• `Optional` **hashDetails**: `TaskHashDetails`

Details about the composition of the hash

___

### id

• **id**: `string`

Unique ID

___

### outputs

• **outputs**: `string`[]

The outputs the task may produce

___

### overrides

• **overrides**: `Record`\<`string`, `unknown`\>

Overrides for the configured options of the target

___

### parallelism

• `Optional` **parallelism**: `boolean`

Determines if a given task should be parallelizable.

___

### projectRoot

• `Optional` **projectRoot**: `string`

Root of the project the task belongs to

___

### startTime

• `Optional` **startTime**: `number`

Unix timestamp of when a Batch Task starts

___

### target

• **target**: `TaskTarget`

Details about which project, target, and configuration to run.
