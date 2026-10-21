Description of a file change in the Nx virtual file system/

## Table of contents

### Properties

- [content](/docs/reference/devkit/FileChange#content)
- [options](/docs/reference/devkit/FileChange#options)
- [path](/docs/reference/devkit/FileChange#path)
- [type](/docs/reference/devkit/FileChange#type)

## Properties

### content

• **content**: `Buffer`\<`ArrayBufferLike`\>

The content of the file or null in case of delete.

___

### options

• `Optional` **options**: `TreeWriteOptions`

Options to set on the file being created or updated.

___

### path

• **path**: `string`

Path relative to the workspace root

___

### type

• **type**: ``"CREATE"`` \| ``"DELETE"`` \| ``"UPDATE"``

Type of change: 'CREATE' | 'DELETE' | 'UPDATE'
