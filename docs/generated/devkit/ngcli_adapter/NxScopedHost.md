# Class: NxScopedHost

## Hierarchy

- `ScopedHost`\<`any`\>

  ↳ **`NxScopedHost`**

## Table of contents

### Constructors

- [constructor](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#constructor)

### Properties

- [\_delegate](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#_delegate): Host<any>
- [\_root](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#_root): Path
- [root](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#root): string

### Accessors

- [capabilities](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#capabilities)

### Methods

- [\_resolve](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#_resolve)
- [delete](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#delete)
- [exists](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#exists)
- [isDirectory](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#isdirectory)
- [isFile](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#isfile)
- [list](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#list)
- [mergeProjectConfiguration](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#mergeprojectconfiguration)
- [read](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#read)
- [readExistingAngularJson](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#readexistingangularjson)
- [readJson](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#readjson)
- [readMergedWorkspaceConfiguration](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#readmergedworkspaceconfiguration)
- [rename](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#rename)
- [stat](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#stat)
- [watch](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#watch)
- [write](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost#write)

## Constructors

### constructor

• **new NxScopedHost**(`root`): [`NxScopedHost`](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost)

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `root` | `string` |

#### Returns

[`NxScopedHost`](/reference/core-api/devkit/documents/ngcli_adapter/NxScopedHost)

#### Overrides

virtualFs.ScopedHost\&lt;any\&gt;.constructor

## Properties

### \_delegate

• `Protected` **\_delegate**: `Host`\<`any`\>

#### Inherited from

virtualFs.ScopedHost.\_delegate

---

### \_root

• `Protected` **\_root**: `Path`

#### Inherited from

virtualFs.ScopedHost.\_root

---

### root

• `Private` **root**: `string`

## Accessors

### capabilities

• `get` **capabilities**(): `HostCapabilities`

#### Returns

`HostCapabilities`

#### Inherited from

virtualFs.ScopedHost.capabilities

## Methods

### \_resolve

▸ **\_resolve**(`path`): `Path`

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `path` | `Path` |

#### Returns

`Path`

#### Inherited from

virtualFs.ScopedHost.\_resolve

---

### delete

▸ **delete**(`path`): `Observable`\<`void`\>

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `path` | `Path` |

#### Returns

`Observable`\<`void`\>

#### Inherited from

virtualFs.ScopedHost.delete

---

### exists

▸ **exists**(`path`): `Observable`\<`boolean`\>

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `path` | `Path` |

#### Returns

`Observable`\<`boolean`\>

#### Overrides

virtualFs.ScopedHost.exists

---

### isDirectory

▸ **isDirectory**(`path`): `Observable`\<`boolean`\>

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `path` | `Path` |

#### Returns

`Observable`\<`boolean`\>

#### Inherited from

virtualFs.ScopedHost.isDirectory

---

### isFile

▸ **isFile**(`path`): `Observable`\<`boolean`\>

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `path` | `Path` |

#### Returns

`Observable`\<`boolean`\>

#### Overrides

virtualFs.ScopedHost.isFile

---

### list

▸ **list**(`path`): `Observable`\<`PathFragment`[]\>

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `path` | `Path` |

#### Returns

`Observable`\<`PathFragment`[]\>

#### Inherited from

virtualFs.ScopedHost.list

---

### mergeProjectConfiguration

▸ **mergeProjectConfiguration**(`existing`, `updated`, `projectName`): `AngularProjectConfiguration`

#### Parameters

| Name          | Type                          |
| :------------ | :---------------------------- |
| `existing`    | `AngularProjectConfiguration` |
| `updated`     | `AngularProjectConfiguration` |
| `projectName` | `string`                      |

#### Returns

`AngularProjectConfiguration`

---

### read

▸ **read**(`path`): `Observable`\<`ArrayBuffer`\>

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `path` | `Path` |

#### Returns

`Observable`\<`ArrayBuffer`\>

#### Overrides

virtualFs.ScopedHost.read

---

### readExistingAngularJson

▸ **readExistingAngularJson**(): `Observable`\<`any`\>

#### Returns

`Observable`\<`any`\>

---

### readJson

▸ **readJson**\<`T`\>(`path`): `Observable`\<`T`\>

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `path` | `string` |

#### Returns

`Observable`\<`T`\>

---

### readMergedWorkspaceConfiguration

▸ **readMergedWorkspaceConfiguration**(): `Observable`\<`any`\>

#### Returns

`Observable`\<`any`\>

---

### rename

▸ **rename**(`from`, `to`): `Observable`\<`void`\>

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `from` | `Path` |
| `to`   | `Path` |

#### Returns

`Observable`\<`void`\>

#### Inherited from

virtualFs.ScopedHost.rename

---

### stat

▸ **stat**(`path`): `Observable`\<`any`\>

#### Parameters

| Name   | Type   |
| :----- | :----- |
| `path` | `Path` |

#### Returns

`Observable`\<`any`\>

#### Inherited from

virtualFs.ScopedHost.stat

---

### watch

▸ **watch**(`path`, `options?`): `Observable`\<`HostWatchEvent`\>

#### Parameters

| Name       | Type               |
| :--------- | :----------------- |
| `path`     | `Path`             |
| `options?` | `HostWatchOptions` |

#### Returns

`Observable`\<`HostWatchEvent`\>

#### Inherited from

virtualFs.ScopedHost.watch

---

### write

▸ **write**(`path`, `content`): `Observable`\<`void`\>

#### Parameters

| Name      | Type          |
| :-------- | :------------ |
| `path`    | `Path`        |
| `content` | `ArrayBuffer` |

#### Returns

`Observable`\<`void`\>

#### Overrides

virtualFs.ScopedHost.write
