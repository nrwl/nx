# Interface: FileData

Some metadata about a file

## Table of contents

### Properties

- [deps](../../devkit/documents/FileData#deps): FileDataDependency[]
- [file](../../devkit/documents/FileData#file): string
- [hash](../../devkit/documents/FileData#hash): string
- [size](../../devkit/documents/FileData#size): number

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

---

### size

• `Optional` **size**: `number`

The size in bytes of this file on the file system \*
