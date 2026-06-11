Virtual file system tree.

## Table of contents

### Properties

- [root](/docs/reference/devkit/Tree#root)

### Methods

- [changePermissions](/docs/reference/devkit/Tree#changepermissions)
- [children](/docs/reference/devkit/Tree#children)
- [delete](/docs/reference/devkit/Tree#delete)
- [exists](/docs/reference/devkit/Tree#exists)
- [isFile](/docs/reference/devkit/Tree#isfile)
- [listChanges](/docs/reference/devkit/Tree#listchanges)
- [read](/docs/reference/devkit/Tree#read)
- [rename](/docs/reference/devkit/Tree#rename)
- [write](/docs/reference/devkit/Tree#write)

## Properties

### root

• **root**: `string`

Root of the workspace. All paths are relative to this.

## Methods

### changePermissions

▸ **changePermissions**(`filePath`, `mode`): `void`

Changes permissions of a file.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filePath` | `string` | A path to a file. |
| `mode` | `Mode` | The permission to be granted on the file, given as a string (e.g `755`) or octal integer (e.g `0o755`). See https://nodejs.org/api/fs.html#fs_file_modes. |

#### Returns

`void`

___

### children

▸ **children**(`dirPath`): `string`[]

Returns the list of children of a folder.

#### Parameters

| Name | Type |
| :------ | :------ |
| `dirPath` | `string` |

#### Returns

`string`[]

___

### delete

▸ **delete**(`filePath`): `void`

Delete the file.

#### Parameters

| Name | Type |
| :------ | :------ |
| `filePath` | `string` |

#### Returns

`void`

___

### exists

▸ **exists**(`filePath`): `boolean`

Check if a file exists.

#### Parameters

| Name | Type |
| :------ | :------ |
| `filePath` | `string` |

#### Returns

`boolean`

___

### isFile

▸ **isFile**(`filePath`): `boolean`

Check if this is a file or not.

#### Parameters

| Name | Type |
| :------ | :------ |
| `filePath` | `string` |

#### Returns

`boolean`

___

### listChanges

▸ **listChanges**(): [`FileChange`](/docs/reference/devkit/FileChange)[]

Returns the list of currently recorded changes.

#### Returns

[`FileChange`](/docs/reference/devkit/FileChange)[]

___

### read

▸ **read**(`filePath`): `Buffer`\<`ArrayBufferLike`\>

Read the contents of a file.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filePath` | `string` | A path to a file. |

#### Returns

`Buffer`\<`ArrayBufferLike`\>

▸ **read**(`filePath`, `encoding`): `string`

Read the contents of a file as string.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `filePath` | `string` | A path to a file. |
| `encoding` | `BufferEncoding` | the encoding for the result |

#### Returns

`string`

___

### rename

▸ **rename**(`from`, `to`): `void`

Rename the file or the folder.

#### Parameters

| Name | Type |
| :------ | :------ |
| `from` | `string` |
| `to` | `string` |

#### Returns

`void`

___

### write

▸ **write**(`filePath`, `content`, `options?`): `void`

Update the contents of a file or create a new file.

#### Parameters

| Name | Type |
| :------ | :------ |
| `filePath` | `string` |
| `content` | `string` \| `Buffer`\<`ArrayBufferLike`\> |
| `options?` | `TreeWriteOptions` |

#### Returns

`void`
