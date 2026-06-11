## Hierarchy

- `ScopedHost`\<`any`\>

  ↳ **`NxScopedHost`**

## Table of contents

### Constructors

- [constructor](/docs/reference/devkit/ngcli_adapter/NxScopedHost#constructor)

### Properties

- [\_delegate](/docs/reference/devkit/ngcli_adapter/NxScopedHost#_delegate)
- [\_projectGraph](/docs/reference/devkit/ngcli_adapter/NxScopedHost#_projectgraph)
- [\_root](/docs/reference/devkit/ngcli_adapter/NxScopedHost#_root)
- [root](/docs/reference/devkit/ngcli_adapter/NxScopedHost#root)

### Accessors

- [capabilities](/docs/reference/devkit/ngcli_adapter/NxScopedHost#capabilities)

### Methods

- [\_resolve](/docs/reference/devkit/ngcli_adapter/NxScopedHost#_resolve)
- [delete](/docs/reference/devkit/ngcli_adapter/NxScopedHost#delete)
- [exists](/docs/reference/devkit/ngcli_adapter/NxScopedHost#exists)
- [isDirectory](/docs/reference/devkit/ngcli_adapter/NxScopedHost#isdirectory)
- [isFile](/docs/reference/devkit/ngcli_adapter/NxScopedHost#isfile)
- [list](/docs/reference/devkit/ngcli_adapter/NxScopedHost#list)
- [mergeProjectConfiguration](/docs/reference/devkit/ngcli_adapter/NxScopedHost#mergeprojectconfiguration)
- [read](/docs/reference/devkit/ngcli_adapter/NxScopedHost#read)
- [readExistingAngularJson](/docs/reference/devkit/ngcli_adapter/NxScopedHost#readexistingangularjson)
- [readJson](/docs/reference/devkit/ngcli_adapter/NxScopedHost#readjson)
- [readMergedWorkspaceConfiguration](/docs/reference/devkit/ngcli_adapter/NxScopedHost#readmergedworkspaceconfiguration)
- [rename](/docs/reference/devkit/ngcli_adapter/NxScopedHost#rename)
- [stat](/docs/reference/devkit/ngcli_adapter/NxScopedHost#stat)
- [watch](/docs/reference/devkit/ngcli_adapter/NxScopedHost#watch)
- [write](/docs/reference/devkit/ngcli_adapter/NxScopedHost#write)

## Constructors

### constructor

• **new NxScopedHost**(`root`, `_projectGraph?`): [`NxScopedHost`](/docs/reference/devkit/ngcli_adapter/NxScopedHost)

#### Parameters

| Name | Type |
| :------ | :------ |
| `root` | `string` |
| `_projectGraph?` | `ProjectGraph` |

#### Returns

[`NxScopedHost`](/docs/reference/devkit/ngcli_adapter/NxScopedHost)

#### Overrides

virtualFs.ScopedHost\&lt;any\&gt;.constructor

## Properties

### \_delegate

• `Protected` **\_delegate**: `Host`\<`any`\>

#### Inherited from

virtualFs.ScopedHost.\_delegate

___

### \_projectGraph

• `Protected` `Optional` **\_projectGraph**: `ProjectGraph`

___

### \_root

• `Protected` **\_root**: `Path`

#### Inherited from

virtualFs.ScopedHost.\_root

___

### root

• `Private` **root**: `any`

## Accessors

### capabilities

• `get` **capabilities**(): `HostCapabilities`

#### Returns

`HostCapabilities`

#### Inherited from

virtualFs.ScopedHost.capabilities

## Methods

### \_resolve

▸ **_resolve**(`path`): `Path`

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |

#### Returns

`Path`

#### Inherited from

virtualFs.ScopedHost.\_resolve

___

### delete

▸ **delete**(`path`): `Observable`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |

#### Returns

`Observable`\<`void`\>

#### Inherited from

virtualFs.ScopedHost.delete

___

### exists

▸ **exists**(`path`): `Observable`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |

#### Returns

`Observable`\<`boolean`\>

#### Overrides

virtualFs.ScopedHost.exists

___

### isDirectory

▸ **isDirectory**(`path`): `Observable`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |

#### Returns

`Observable`\<`boolean`\>

#### Inherited from

virtualFs.ScopedHost.isDirectory

___

### isFile

▸ **isFile**(`path`): `Observable`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |

#### Returns

`Observable`\<`boolean`\>

#### Overrides

virtualFs.ScopedHost.isFile

___

### list

▸ **list**(`path`): `Observable`\<`PathFragment`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |

#### Returns

`Observable`\<`PathFragment`[]\>

#### Inherited from

virtualFs.ScopedHost.list

___

### mergeProjectConfiguration

▸ **mergeProjectConfiguration**(`existing`, `updated`, `projectName`): `AngularProjectConfiguration`

#### Parameters

| Name | Type |
| :------ | :------ |
| `existing` | `AngularProjectConfiguration` |
| `updated` | `AngularProjectConfiguration` |
| `projectName` | `string` |

#### Returns

`AngularProjectConfiguration`

___

### read

▸ **read**(`path`): `Observable`\<`ArrayBuffer`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |

#### Returns

`Observable`\<`ArrayBuffer`\>

#### Overrides

virtualFs.ScopedHost.read

___

### readExistingAngularJson

▸ **readExistingAngularJson**(): `Observable`\<`any`\>

#### Returns

`Observable`\<`any`\>

___

### readJson

▸ **readJson**\<`T`\>(`path`): `Observable`\<`T`\>

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `any` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `string` |

#### Returns

`Observable`\<`T`\>

___

### readMergedWorkspaceConfiguration

▸ **readMergedWorkspaceConfiguration**(): `Observable`\<`any`\>

#### Returns

`Observable`\<`any`\>

___

### rename

▸ **rename**(`from`, `to`): `Observable`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `from` | `Path` |
| `to` | `Path` |

#### Returns

`Observable`\<`void`\>

#### Inherited from

virtualFs.ScopedHost.rename

___

### stat

▸ **stat**(`path`): `Observable`\<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |

#### Returns

`Observable`\<`any`\>

#### Inherited from

virtualFs.ScopedHost.stat

___

### watch

▸ **watch**(`path`, `options?`): `Observable`\<`HostWatchEvent`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |
| `options?` | `HostWatchOptions` |

#### Returns

`Observable`\<`HostWatchEvent`\>

#### Inherited from

virtualFs.ScopedHost.watch

___

### write

▸ **write**(`path`, `content`): `Observable`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `path` | `Path` |
| `content` | `ArrayBuffer` |

#### Returns

`Observable`\<`void`\>

#### Overrides

virtualFs.ScopedHost.write
