# Interface: TargetDependencyConfig

## Table of contents

### Properties

- [dependencies](../../devkit/documents/TargetDependencyConfig#dependencies): boolean
- [params](../../devkit/documents/TargetDependencyConfig#params): "ignore" | "forward"
- [projects](../../devkit/documents/TargetDependencyConfig#projects): string | string[]
- [target](../../devkit/documents/TargetDependencyConfig#target): string

## Properties

### dependencies

• `Optional` **dependencies**: `boolean`

If true, the target will be executed for each project that this project depends on.
Should not be specified together with `projects`.

---

### params

• `Optional` **params**: `"ignore"` \| `"forward"`

Configuration for params handling.

---

### projects

• `Optional` **projects**: `string` \| `string`[]

A list of projects that have `target`.
Should not be specified together with `dependencies`.

---

### target

• **target**: `string`

The name of the target to run. If `projects` and `dependencies` are not specified,
the target will be executed for the same project the the current target is running on`.
