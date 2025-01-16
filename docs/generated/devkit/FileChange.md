# Interface: FileChange

Description of a file change in the Nx virtual file system/

## Table of contents

### Properties

- [content](../../devkit/documents/FileChange#content): Buffer<ArrayBufferLike>
- [options](../../devkit/documents/FileChange#options): TreeWriteOptions
- [path](../../devkit/documents/FileChange#path): string
- [type](../../devkit/documents/FileChange#type): "CREATE" | "DELETE" | "UPDATE"

## Properties

### content

• **content**: `Buffer`\<`ArrayBufferLike`\>

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
