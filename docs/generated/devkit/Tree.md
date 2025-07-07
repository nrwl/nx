# Interface: Tree

Virtual file system tree.

## Table of contents

### Properties

- [root](/reference/core-api/devkit/documents/Tree#root): string

### Methods

- [changePermissions](/reference/core-api/devkit/documents/Tree#changepermissions)
- [children](/reference/core-api/devkit/documents/Tree#children)
- [delete](/reference/core-api/devkit/documents/Tree#delete)
- [exists](/reference/core-api/devkit/documents/Tree#exists)
- [isFile](/reference/core-api/devkit/documents/Tree#isfile)
- [listChanges](/reference/core-api/devkit/documents/Tree#listchanges)
- [read](/reference/core-api/devkit/documents/Tree#read)
- [rename](/reference/core-api/devkit/documents/Tree#rename)
- [write](/reference/core-api/devkit/documents/Tree#write)

## Properties

### root

• **root**: `string`

Root of the workspace. All paths are relative to this.

## Methods

### changePermissions

▸ **changePermissions**(`filePath`, `mode`): `void`

Changes permissions of a file.

#### Parameters

| Name       | Type     | Description                                                                                                                                               |
| :--------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filePath` | `string` | A path to a file.                                                                                                                                         |
| `mode`     | `Mode`   | The permission to be granted on the file, given as a string (e.g `755`) or octal integer (e.g `0o755`). See https://nodejs.org/api/fs.html#fs_file_modes. |

#### Returns

`void`

---

### children

▸ **children**(`dirPath`): `string`[]

Returns the list of children of a folder.

#### Parameters

| Name      | Type     |
| :-------- | :------- |
| `dirPath` | `string` |

#### Returns

`string`[]

---

### delete

▸ **delete**(`filePath`): `void`

Delete the file.

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `filePath` | `string` |

#### Returns

`void`

---

### exists

▸ **exists**(`filePath`): `boolean`

Check if a file exists.

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `filePath` | `string` |

#### Returns

`boolean`

---

### isFile

▸ **isFile**(`filePath`): `boolean`

Check if this is a file or not.

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `filePath` | `string` |

#### Returns

`boolean`

---

### listChanges

▸ **listChanges**(): [`FileChange`](/reference/core-api/devkit/documents/FileChange)[]

Returns the list of currently recorded changes.

#### Returns

[`FileChange`](/reference/core-api/devkit/documents/FileChange)[]

---

### read

▸ **read**(`filePath`): `Buffer`\<`ArrayBufferLike`\>

Read the contents of a file.

#### Parameters

| Name       | Type     | Description       |
| :--------- | :------- | :---------------- |
| `filePath` | `string` | A path to a file. |

#### Returns

`Buffer`\<`ArrayBufferLike`\>

▸ **read**(`filePath`, `encoding`): `string`

Read the contents of a file as string.

#### Parameters

| Name       | Type             | Description                 |
| :--------- | :--------------- | :-------------------------- |
| `filePath` | `string`         | A path to a file.           |
| `encoding` | `BufferEncoding` | the encoding for the result |

#### Returns

`string`

---

### rename

▸ **rename**(`from`, `to`): `void`

Rename the file or the folder.

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `from` | `string` |
| `to`   | `string` |

#### Returns

`void`

---

### write

▸ **write**(`filePath`, `content`, `options?`): `void`

Update the contents of a file or create a new file.

#### Parameters

| Name       | Type                                      |
| :--------- | :---------------------------------------- |
| `filePath` | `string`                                  |
| `content`  | `string` \| `Buffer`\<`ArrayBufferLike`\> |
| `options?` | `TreeWriteOptions`                        |

#### Returns

`void`
