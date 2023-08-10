# Class: Workspaces

## Table of contents

### Constructors

- [constructor](../../devkit/documents/Workspaces#constructor)

### Properties

- [cachedProjectsConfig](../../devkit/documents/Workspaces#cachedprojectsconfig)
- [root](../../devkit/documents/Workspaces#root)

### Methods

- [mergeTargetDefaultsIntoProjectDescriptions](../../devkit/documents/Workspaces#mergetargetdefaultsintoprojectdescriptions)
- [readProjectsConfigurations](../../devkit/documents/Workspaces#readprojectsconfigurations)
- [readWorkspaceConfiguration](../../devkit/documents/Workspaces#readworkspaceconfiguration)

## Constructors

### constructor

• **new Workspaces**(`root`)

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `root` | `string` |

## Properties

### cachedProjectsConfig

• `Private` **cachedProjectsConfig**: [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

---

### root

• `Private` **root**: `string`

## Methods

### mergeTargetDefaultsIntoProjectDescriptions

▸ `Private` **mergeTargetDefaultsIntoProjectDescriptions**(`projects`, `nxJson`): `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>

#### Parameters

| Name       | Type                                                                                       |
| :--------- | :----------------------------------------------------------------------------------------- |
| `projects` | `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\> |
| `nxJson`   | [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)<`string`[] \| `"*"`\>  |

#### Returns

`Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>

---

### readProjectsConfigurations

▸ **readProjectsConfigurations**(`opts?`): [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

**`Deprecated`**

#### Parameters

| Name                                    | Type      |
| :-------------------------------------- | :-------- |
| `opts?`                                 | `Object`  |
| `opts._includeProjectsFromAngularJson?` | `boolean` |

#### Returns

[`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

---

### readWorkspaceConfiguration

▸ **readWorkspaceConfiguration**(`opts?`): [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations) & [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)<`string`[] \| `"*"`\>

Deprecated. Use readProjectsConfigurations

#### Parameters

| Name                                    | Type      |
| :-------------------------------------- | :-------- |
| `opts?`                                 | `Object`  |
| `opts._ignorePluginInference?`          | `boolean` |
| `opts._includeProjectsFromAngularJson?` | `boolean` |

#### Returns

[`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations) & [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)<`string`[] \| `"*"`\>
