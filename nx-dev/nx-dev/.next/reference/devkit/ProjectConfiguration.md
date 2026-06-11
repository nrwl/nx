Project configuration

@note: when adding properties here add them to `allowedProjectExtensions` in adapter/compat.ts

## Table of contents

### Properties

- [generators](/docs/reference/devkit/ProjectConfiguration#generators)
- [implicitDependencies](/docs/reference/devkit/ProjectConfiguration#implicitdependencies)
- [metadata](/docs/reference/devkit/ProjectConfiguration#metadata)
- [name](/docs/reference/devkit/ProjectConfiguration#name)
- [namedInputs](/docs/reference/devkit/ProjectConfiguration#namedinputs)
- [projectType](/docs/reference/devkit/ProjectConfiguration#projecttype)
- [release](/docs/reference/devkit/ProjectConfiguration#release)
- [root](/docs/reference/devkit/ProjectConfiguration#root)
- [sourceRoot](/docs/reference/devkit/ProjectConfiguration#sourceroot)
- [tags](/docs/reference/devkit/ProjectConfiguration#tags)
- [targets](/docs/reference/devkit/ProjectConfiguration#targets)

## Properties

### generators

• `Optional` **generators**: `Object`

List of default values used by generators.

These defaults are project specific.

Example:

```
{
  "@nx/react": {
    "library": {
      "style": "scss"
    }
  }
}
```

#### Index signature

▪ [collectionName: `string`]: \{ `[generatorName: string]`: `any`;  }

___

### implicitDependencies

• `Optional` **implicitDependencies**: `string`[]

List of projects which are added as a dependency

___

### metadata

• `Optional` **metadata**: `ProjectMetadata`

Metadata about the project

___

### name

• `Optional` **name**: `string`

Project's name. Optional if specified in workspace.json

___

### namedInputs

• `Optional` **namedInputs**: `Object`

Named inputs targets can refer to reduce duplication

#### Index signature

▪ [inputName: `string`]: (`string` \| `InputDefinition`)[]

___

### projectType

• `Optional` **projectType**: [`ProjectType`](/docs/reference/devkit/ProjectType)

Project type

___

### release

• `Optional` **release**: `Object`

Project specific configuration for `nx release`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `docker?` | ``true`` \| `NxReleaseDockerConfiguration` |
| `version?` | `Pick`\<`NxReleaseVersionConfiguration`, ``"versionActions"`` \| ``"versionActionsOptions"`` \| ``"manifestRootsToUpdate"`` \| ``"currentVersionResolver"`` \| ``"currentVersionResolverMetadata"`` \| ``"fallbackCurrentVersionResolver"`` \| ``"versionPrefix"`` \| ``"preserveLocalDependencyProtocols"``\> |

___

### root

• **root**: `string`

Project's location relative to the root of the workspace

___

### sourceRoot

• `Optional` **sourceRoot**: `string`

The location of project's sources relative to the root of the workspace

___

### tags

• `Optional` **tags**: `string`[]

List of tags used by enforce-module-boundaries / project graph

___

### targets

• `Optional` **targets**: `Object`

Project's targets

#### Index signature

▪ [targetName: `string`]: [`TargetConfiguration`](/docs/reference/devkit/TargetConfiguration)
