# Interface: FileChange

Description of a file change in the Nx virtual file system/

## Table of contents

### Properties

- [content](../../devkit/documents/FileChange#content)
- [options](../../devkit/documents/FileChange#options)
- [path](../../devkit/documents/FileChange#path)
- [type](../../devkit/documents/FileChange#type)

## Properties

### content

• **content**: `Buffer`

The content of the file or null in case of delete.

---

### options

• `Optional` **options**: `TreeWriteOptions`

Options to set on the file being created or updated.

---

### path

• **path**: `string`

Path relative to the workspace root

---

### type

• **type**: `"CREATE"` \| `"DELETE"` \| `"UPDATE"`

Type of change: 'CREATE' | 'DELETE' | 'UPDATE'
