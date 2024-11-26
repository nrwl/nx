# Interface: TargetConfiguration\<T\>

Target's configuration

## Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

## Table of contents

### Properties

- [cache](../../devkit/documents/TargetConfiguration#cache): boolean
- [command](../../devkit/documents/TargetConfiguration#command): string
- [configurations](../../devkit/documents/TargetConfiguration#configurations): Object
- [defaultConfiguration](../../devkit/documents/TargetConfiguration#defaultconfiguration): string
- [dependsOn](../../devkit/documents/TargetConfiguration#dependson): (string | TargetDependencyConfig)[]
- [executor](../../devkit/documents/TargetConfiguration#executor): string
- [inputs](../../devkit/documents/TargetConfiguration#inputs): (string | InputDefinition)[]
- [metadata](../../devkit/documents/TargetConfiguration#metadata): TargetMetadata
- [options](../../devkit/documents/TargetConfiguration#options): T
- [outputs](../../devkit/documents/TargetConfiguration#outputs): string[]
- [parallelism](../../devkit/documents/TargetConfiguration#parallelism): boolean
- [syncGenerators](../../devkit/documents/TargetConfiguration#syncgenerators): string[]

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

### defaultConfiguration

• `Optional` **defaultConfiguration**: `string`

A default named configuration to use when a target configuration is not provided.

---

### dependsOn

• `Optional` **dependsOn**: (`string` \| [`TargetDependencyConfig`](../../devkit/documents/TargetDependencyConfig))[]

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
