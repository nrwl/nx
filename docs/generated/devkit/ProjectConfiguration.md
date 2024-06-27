# Interface: ProjectConfiguration

Project configuration

## Table of contents

### Properties

- [generators](../../devkit/documents/ProjectConfiguration#generators): Object
- [implicitDependencies](../../devkit/documents/ProjectConfiguration#implicitdependencies): string[]
- [metadata](../../devkit/documents/ProjectConfiguration#metadata): ProjectMetadata
- [name](../../devkit/documents/ProjectConfiguration#name): string
- [namedInputs](../../devkit/documents/ProjectConfiguration#namedinputs): Object
- [projectType](../../devkit/documents/ProjectConfiguration#projecttype): ProjectType
- [release](../../devkit/documents/ProjectConfiguration#release): Object
- [root](../../devkit/documents/ProjectConfiguration#root): string
- [sourceRoot](../../devkit/documents/ProjectConfiguration#sourceroot): string
- [tags](../../devkit/documents/ProjectConfiguration#tags): string[]
- [targets](../../devkit/documents/ProjectConfiguration#targets): Object

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

▪ [collectionName: `string`]: \{ `[generatorName: string]`: `any`; }

---

### implicitDependencies

• `Optional` **implicitDependencies**: `string`[]

List of projects which are added as a dependency

---

### metadata

• `Optional` **metadata**: `ProjectMetadata`

Metadata about the project

---

### name

• `Optional` **name**: `string`

Project's name. Optional if specified in workspace.json

---

### namedInputs

• `Optional` **namedInputs**: `Object`

Named inputs targets can refer to reduce duplication

#### Index signature

▪ [inputName: `string`]: (`string` \| `InputDefinition`)[]

---

### projectType

• `Optional` **projectType**: [`ProjectType`](../../devkit/documents/ProjectType)

Project type

---

### release

• `Optional` **release**: `Object`

Project specific configuration for `nx release`

#### Type declaration

| Name       | Type                                                                             |
| :--------- | :------------------------------------------------------------------------------- |
| `version?` | `Pick`\<`NxReleaseVersionConfiguration`, `"generator"` \| `"generatorOptions"`\> |

---

### root

• **root**: `string`

Project's location relative to the root of the workspace

---

### sourceRoot

• `Optional` **sourceRoot**: `string`

The location of project's sources relative to the root of the workspace

---

### tags

• `Optional` **tags**: `string`[]

List of tags used by enforce-module-boundaries / project graph

---

### targets

• `Optional` **targets**: `Object`

Project's targets

#### Index signature

▪ [targetName: `string`]: [`TargetConfiguration`](../../devkit/documents/TargetConfiguration)
