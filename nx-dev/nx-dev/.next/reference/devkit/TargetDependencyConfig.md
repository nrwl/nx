## Table of contents

### Properties

- [dependencies](/docs/reference/devkit/TargetDependencyConfig#dependencies)
- [options](/docs/reference/devkit/TargetDependencyConfig#options)
- [params](/docs/reference/devkit/TargetDependencyConfig#params)
- [projects](/docs/reference/devkit/TargetDependencyConfig#projects)
- [target](/docs/reference/devkit/TargetDependencyConfig#target)

## Properties

### dependencies

• `Optional` **dependencies**: `boolean`

If true, the target will be executed for each project that this project depends on.
Should not be specified together with `projects`.

___

### options

• `Optional` **options**: ``"ignore"`` \| ``"forward"``

Whether to forward task options to the dependency target.

___

### params

• `Optional` **params**: ``"ignore"`` \| ``"forward"``

Whether to forward CLI params to the dependency target.

___

### projects

• `Optional` **projects**: `string` \| `string`[]

A list of projects that have `target`.
Should not be specified together with `dependencies`.

___

### target

• **target**: `string`

The name of the target to run. If `projects` and `dependencies` are not specified,
the target will be executed for the same project the the current target is running on`.
