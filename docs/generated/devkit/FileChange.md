# Interface: FileChange

Description of a file change in the Nx virtual file system/

## Table of contents

### Properties

- [content](../../devkit/documents/FileChange#content): Buffer
- [options](../../devkit/documents/FileChange#options): TreeWriteOptions
- [path](../../devkit/documents/FileChange#path): string
- [type](../../devkit/documents/FileChange#type): "DELETE" | "CREATE" | "UPDATE"

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

• **type**: `"DELETE"` \| `"CREATE"` \| `"UPDATE"`

Type of change: 'CREATE' | 'DELETE' | 'UPDATE'
