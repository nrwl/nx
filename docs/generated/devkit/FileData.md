# Interface: FileData

Some metadata about a file

## Table of contents

### Properties

- [deps](/reference/core-api/devkit/documents/FileData#deps): FileDataDependency[]
- [file](/reference/core-api/devkit/documents/FileData#file): string
- [hash](/reference/core-api/devkit/documents/FileData#hash): string

## Properties

### deps

• `Optional` **deps**: `FileDataDependency`[]

An array of dependencies. If an element is just a string,
the dependency is assumed to be a static dependency targetting
that string. If the element is a tuple with two elements, the first element
inside of it is the target project, with the second element being the type of dependency.
If the tuple has 3 elements, the first is preceded by a source.

---

### file

• **file**: `string`

---

### hash

• **hash**: `string`
