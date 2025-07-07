# Interface: PackageManagerCommands

## Table of contents

### Properties

- [add](/reference/core-api/devkit/documents/PackageManagerCommands#add): string
- [addDev](/reference/core-api/devkit/documents/PackageManagerCommands#adddev): string
- [ciInstall](/reference/core-api/devkit/documents/PackageManagerCommands#ciinstall): string
- [dlx](/reference/core-api/devkit/documents/PackageManagerCommands#dlx): string
- [exec](/reference/core-api/devkit/documents/PackageManagerCommands#exec): string
- [getRegistryUrl](/reference/core-api/devkit/documents/PackageManagerCommands#getregistryurl): string
- [install](/reference/core-api/devkit/documents/PackageManagerCommands#install): string
- [list](/reference/core-api/devkit/documents/PackageManagerCommands#list): string
- [preInstall](/reference/core-api/devkit/documents/PackageManagerCommands#preinstall): string
- [publish](/reference/core-api/devkit/documents/PackageManagerCommands#publish): Function
- [rm](/reference/core-api/devkit/documents/PackageManagerCommands#rm): string
- [run](/reference/core-api/devkit/documents/PackageManagerCommands#run): Function
- [updateLockFile](/reference/core-api/devkit/documents/PackageManagerCommands#updatelockfile): string

## Properties

### add

• **add**: `string`

---

### addDev

• **addDev**: `string`

---

### ciInstall

• **ciInstall**: `string`

---

### dlx

• **dlx**: `string`

---

### exec

• **exec**: `string`

---

### getRegistryUrl

• `Optional` **getRegistryUrl**: `string`

---

### install

• **install**: `string`

---

### list

• **list**: `string`

---

### preInstall

• `Optional` **preInstall**: `string`

---

### publish

• **publish**: (`packageRoot`: `string`, `registry`: `string`, `registryConfigKey`: `string`, `tag`: `string`) => `string`

#### Type declaration

▸ (`packageRoot`, `registry`, `registryConfigKey`, `tag`): `string`

##### Parameters

| Name                | Type     |
| :------------------ | :------- |
| `packageRoot`       | `string` |
| `registry`          | `string` |
| `registryConfigKey` | `string` |
| `tag`               | `string` |

##### Returns

`string`

---

### rm

• **rm**: `string`

---

### run

• **run**: (`script`: `string`, `args?`: `string`) => `string`

#### Type declaration

▸ (`script`, `args?`): `string`

##### Parameters

| Name     | Type     |
| :------- | :------- |
| `script` | `string` |
| `args?`  | `string` |

##### Returns

`string`

---

### updateLockFile

• **updateLockFile**: `string`
