# Interface: ProjectConfiguration

Project configuration

@note: when adding properties here add them to `allowedProjectExtensions` in adapter/compat.ts

## Table of contents

### Properties

- [generators](../../devkit/documents/ProjectConfiguration#generators)
- [implicitDependencies](../../devkit/documents/ProjectConfiguration#implicitdependencies)
- [name](../../devkit/documents/ProjectConfiguration#name)
- [namedInputs](../../devkit/documents/ProjectConfiguration#namedinputs)
- [projectType](../../devkit/documents/ProjectConfiguration#projecttype)
- [root](../../devkit/documents/ProjectConfiguration#root)
- [sourceRoot](../../devkit/documents/ProjectConfiguration#sourceroot)
- [tags](../../devkit/documents/ProjectConfiguration#tags)
- [targets](../../devkit/documents/ProjectConfiguration#targets)

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

▪ [collectionName: `string`]: { `[generatorName: string]`: `any`; }

---

### implicitDependencies

• `Optional` **implicitDependencies**: `string`[]

List of projects which are added as a dependency

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
