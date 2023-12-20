# Class: NxScopedHost

## Hierarchy

- `ScopedHost`\<`any`\>

  ↳ **`NxScopedHost`**

## Table of contents

### Constructors

- [constructor](../../devkit/documents/ngcli_adapter/NxScopedHost#constructor)

### Properties

- [\_delegate](../../devkit/documents/ngcli_adapter/NxScopedHost#_delegate): Host<any>
- [\_root](../../devkit/documents/ngcli_adapter/NxScopedHost#_root): Path
- [root](../../devkit/documents/ngcli_adapter/NxScopedHost#root): string

### Accessors

- [capabilities](../../devkit/documents/ngcli_adapter/NxScopedHost#capabilities)

### Methods

- [\_resolve](../../devkit/documents/ngcli_adapter/NxScopedHost#_resolve)
- [delete](../../devkit/documents/ngcli_adapter/NxScopedHost#delete)
- [exists](../../devkit/documents/ngcli_adapter/NxScopedHost#exists)
- [isDirectory](../../devkit/documents/ngcli_adapter/NxScopedHost#isdirectory)
- [isFile](../../devkit/documents/ngcli_adapter/NxScopedHost#isfile)
- [list](../../devkit/documents/ngcli_adapter/NxScopedHost#list)
- [mergeProjectConfiguration](../../devkit/documents/ngcli_adapter/NxScopedHost#mergeprojectconfiguration)
- [read](../../devkit/documents/ngcli_adapter/NxScopedHost#read)
- [readExistingAngularJson](../../devkit/documents/ngcli_adapter/NxScopedHost#readexistingangularjson)
- [readJson](../../devkit/documents/ngcli_adapter/NxScopedHost#readjson)
- [readMergedWorkspaceConfiguration](../../devkit/documents/ngcli_adapter/NxScopedHost#readmergedworkspaceconfiguration)
- [rename](../../devkit/documents/ngcli_adapter/NxScopedHost#rename)
- [stat](../../devkit/documents/ngcli_adapter/NxScopedHost#stat)
- [watch](../../devkit/documents/ngcli_adapter/NxScopedHost#watch)
- [write](../../devkit/documents/ngcli_adapter/NxScopedHost#write)

## Constructors

### constructor

• **new NxScopedHost**(`root`): [`NxScopedHost`](../../devkit/documents/ngcli_adapter/NxScopedHost)

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `root` | `string` |

#### Returns

[`NxScopedHost`](../../devkit/documents/ngcli_adapter/NxScopedHost)

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
