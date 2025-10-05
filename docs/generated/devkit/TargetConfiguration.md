# Interface: TargetConfiguration\<T\>

Target's configuration

## Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

## Table of contents

### Properties

- [cache](/reference/core-api/devkit/documents/TargetConfiguration#cache): boolean
- [command](/reference/core-api/devkit/documents/TargetConfiguration#command): string
- [configurations](/reference/core-api/devkit/documents/TargetConfiguration#configurations): Object
- [continuous](/reference/core-api/devkit/documents/TargetConfiguration#continuous): boolean
- [defaultConfiguration](/reference/core-api/devkit/documents/TargetConfiguration#defaultconfiguration): string
- [dependsOn](/reference/core-api/devkit/documents/TargetConfiguration#dependson): (string | TargetDependencyConfig)[]
- [executor](/reference/core-api/devkit/documents/TargetConfiguration#executor): string
- [inputs](/reference/core-api/devkit/documents/TargetConfiguration#inputs): (string | InputDefinition)[]
- [metadata](/reference/core-api/devkit/documents/TargetConfiguration#metadata): TargetMetadata
- [options](/reference/core-api/devkit/documents/TargetConfiguration#options): T
- [outputs](/reference/core-api/devkit/documents/TargetConfiguration#outputs): string[]
- [parallelism](/reference/core-api/devkit/documents/TargetConfiguration#parallelism): boolean
- [syncGenerators](/reference/core-api/devkit/documents/TargetConfiguration#syncgenerators): string[]

## Properties

### cache

• `Optional` **cache**: `boolean`

Determines if Nx is able to cache a given target.

---

### command

• `Optional` **command**: `string`

Used as a shorthand for nx:run-commands, a command to run.

---

### configurations

• `Optional` **configurations**: `Object`

Sets of options

#### Index signature

▪ [config: `string`]: `any`

---

### continuous

• `Optional` **continuous**: `boolean`

Whether this target runs continuously

---

### defaultConfiguration

• `Optional` **defaultConfiguration**: `string`

A default named configuration to use when a target configuration is not provided.

---

### dependsOn

• `Optional` **dependsOn**: (`string` \| [`TargetDependencyConfig`](/reference/core-api/devkit/documents/TargetDependencyConfig))[]

This describes other targets that a target depends on.

---

### executor

• `Optional` **executor**: `string`

The executor/builder used to implement the target.

Example: '@nx/rollup:rollup'

---

### inputs

• `Optional` **inputs**: (`string` \| `InputDefinition`)[]

This describes filesets, runtime dependencies and other inputs that a target depends on.

---

### metadata

• `Optional` **metadata**: `TargetMetadata`

Metadata about the target

---

### options

• `Optional` **options**: `T`

Target's options. They are passed in to the executor.

---

### outputs

• `Optional` **outputs**: `string`[]

List of the target's outputs. The outputs will be cached by the Nx computation
caching engine.

---

### parallelism

• `Optional` **parallelism**: `boolean`

Whether this target can be run in parallel with other tasks
Default is true

---

### syncGenerators

• `Optional` **syncGenerators**: `string`[]

List of generators to run before the target to ensure the workspace
is up to date.
