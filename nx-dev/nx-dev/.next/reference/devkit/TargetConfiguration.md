Target's configuration

## Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `any` |

## Table of contents

### Properties

- [...](/docs/reference/devkit/TargetConfiguration#...)
- [cache](/docs/reference/devkit/TargetConfiguration#cache)
- [command](/docs/reference/devkit/TargetConfiguration#command)
- [configurations](/docs/reference/devkit/TargetConfiguration#configurations)
- [continuous](/docs/reference/devkit/TargetConfiguration#continuous)
- [defaultConfiguration](/docs/reference/devkit/TargetConfiguration#defaultconfiguration)
- [dependsOn](/docs/reference/devkit/TargetConfiguration#dependson)
- [executor](/docs/reference/devkit/TargetConfiguration#executor)
- [inputs](/docs/reference/devkit/TargetConfiguration#inputs)
- [metadata](/docs/reference/devkit/TargetConfiguration#metadata)
- [options](/docs/reference/devkit/TargetConfiguration#options)
- [outputs](/docs/reference/devkit/TargetConfiguration#outputs)
- [parallelism](/docs/reference/devkit/TargetConfiguration#parallelism)
- [syncGenerators](/docs/reference/devkit/TargetConfiguration#syncgenerators)

## Properties

### ...

• `Optional` **...**: ``true``

Spread token used when merging target configurations. When set to `true`,
base (inferred) values take priority over this target's values for any
shared keys — effectively "only add new keys without overwriting inferred
values". Keys that do not exist in the base target are still added.

The position of `'...'` in the object's key order follows standard
last-write-wins semantics with [https://nx.dev/reference/project-configuration#spread-token](https://nx.dev/reference/project-configuration#spread-token).

___

### cache

• `Optional` **cache**: `boolean`

Determines if Nx is able to cache a given target.

___

### command

• `Optional` **command**: `string`

Used as a shorthand for nx:run-commands, a command to run.

___

### configurations

• `Optional` **configurations**: `Object`

Sets of options

#### Index signature

▪ [config: `string`]: `any`

___

### continuous

• `Optional` **continuous**: `boolean`

Whether this target runs continuously

___

### defaultConfiguration

• `Optional` **defaultConfiguration**: `string`

A default named configuration to use when a target configuration is not provided.

___

### dependsOn

• `Optional` **dependsOn**: (`string` \| [`TargetDependencyConfig`](/docs/reference/devkit/TargetDependencyConfig))[]

This describes other targets that a target depends on.

___

### executor

• `Optional` **executor**: `string`

The executor/builder used to implement the target.

Example: '@nx/rollup:rollup'

___

### inputs

• `Optional` **inputs**: (`string` \| `InputDefinition`)[]

This describes filesets, runtime dependencies and other inputs that a target depends on.

___

### metadata

• `Optional` **metadata**: `TargetMetadata`

Metadata about the target

___

### options

• `Optional` **options**: `T`

Target's options. They are passed in to the executor.

___

### outputs

• `Optional` **outputs**: `string`[]

List of the target's outputs. The outputs will be cached by the Nx computation
caching engine.

___

### parallelism

• `Optional` **parallelism**: `boolean`

Whether this target can be run in parallel with other tasks
Default is true

___

### syncGenerators

• `Optional` **syncGenerators**: `string`[]

List of generators to run before the target to ensure the workspace
is up to date.
