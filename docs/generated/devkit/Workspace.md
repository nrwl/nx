# Interface: Workspace

**`Deprecated`**

use ProjectsConfigurations or NxJsonConfiguration

## Hierarchy

- [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

- [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)

  ↳ **`Workspace`**

## Table of contents

### Properties

- [affected](../../devkit/documents/Workspace#affected)
- [cli](../../devkit/documents/Workspace#cli)
- [defaultProject](../../devkit/documents/Workspace#defaultproject)
- [extends](../../devkit/documents/Workspace#extends)
- [generators](../../devkit/documents/Workspace#generators)
- [implicitDependencies](../../devkit/documents/Workspace#implicitdependencies)
- [installation](../../devkit/documents/Workspace#installation)
- [namedInputs](../../devkit/documents/Workspace#namedinputs)
- [npmScope](../../devkit/documents/Workspace#npmscope)
- [plugins](../../devkit/documents/Workspace#plugins)
- [pluginsConfig](../../devkit/documents/Workspace#pluginsconfig)
- [projects](../../devkit/documents/Workspace#projects)
- [targetDefaults](../../devkit/documents/Workspace#targetdefaults)
- [tasksRunnerOptions](../../devkit/documents/Workspace#tasksrunneroptions)
- [version](../../devkit/documents/Workspace#version)
- [workspaceLayout](../../devkit/documents/Workspace#workspacelayout)

## Properties

### affected

• `Optional` **affected**: [`NxAffectedConfig`](../../devkit/documents/NxAffectedConfig)

Default options for `nx affected`

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[affected](../../devkit/documents/NxJsonConfiguration#affected)

---

### cli

• `Optional` **cli**: `Object`

Default generator collection. It is used when no collection is provided.

#### Type declaration

| Name                  | Type                                                      | Description                                                            |
| :-------------------- | :-------------------------------------------------------- | :--------------------------------------------------------------------- |
| `defaultCollection?`  | `string`                                                  | **`Deprecated`** - defaultCollection is deprecated and will be removed |
| `defaultProjectName?` | `string`                                                  | -                                                                      |
| `packageManager?`     | [`PackageManager`](../../devkit/documents/PackageManager) | -                                                                      |

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[cli](../../devkit/documents/NxJsonConfiguration#cli)

---

### defaultProject

• `Optional` **defaultProject**: `string`

Default project. When project isn't provided, the default project
will be used. Convenient for small workspaces with one main application.

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[defaultProject](../../devkit/documents/NxJsonConfiguration#defaultproject)

---

### extends

• `Optional` **extends**: `string`

Optional (additional) Nx.json configuration file which becomes a base for this one

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[extends](../../devkit/documents/NxJsonConfiguration#extends)

---

### generators

• `Optional` **generators**: `Object`

List of default values used by generators.

These defaults are global. They are used when no other defaults are configured.

Example:

```
{
  "@nx/react": {
    "library": {
      "style": "scss"
    }
  }
}
```

#### Index signature

▪ [collectionName: `string`]: { `[generatorName: string]`: `any`; }

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[generators](../../devkit/documents/NxJsonConfiguration#generators)

---

### implicitDependencies

• `Optional` **implicitDependencies**: [`ImplicitDependencyEntry`](../../devkit/documents/ImplicitDependencyEntry)<`string`[] \| `"*"`\>

Map of files to projects that implicitly depend on them

**`Deprecated`**

use [namedInputs](../../devkit/documents/Workspace#namedinputs) instead. For more information see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[implicitDependencies](../../devkit/documents/NxJsonConfiguration#implicitdependencies)

---

### installation

• `Optional` **installation**: `NxInstallationConfiguration`

Configures the Nx installation for a repo. Useful for maintaining a separate
set of dependencies for Nx + Plugins compared to the base package.json, but also
useful for workspaces that don't have a root package.json + node_modules.

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[installation](../../devkit/documents/NxJsonConfiguration#installation)

---

### namedInputs

• `Optional` **namedInputs**: `Object`

Named inputs targets can refer to reduce duplication

#### Index signature

▪ [inputName: `string`]: (`string` \| `InputDefinition`)[]

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[namedInputs](../../devkit/documents/NxJsonConfiguration#namedinputs)

---

### npmScope

• `Optional` **npmScope**: `string`

**`Deprecated`**

This is inferred from the package.json in the workspace root. Please use getNpmScope instead.
NPM Scope that the workspace uses

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[npmScope](../../devkit/documents/NxJsonConfiguration#npmscope)

---

### plugins

• `Optional` **plugins**: `string`[]

Plugins for extending the project graph

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[plugins](../../devkit/documents/NxJsonConfiguration#plugins)

---

### pluginsConfig

• `Optional` **pluginsConfig**: `Record`<`string`, `unknown`\>

Configuration for Nx Plugins

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[pluginsConfig](../../devkit/documents/NxJsonConfiguration#pluginsconfig)

---

### projects

• **projects**: `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>

Projects' projects

#### Overrides

[ProjectsConfigurations](../../devkit/documents/ProjectsConfigurations).[projects](../../devkit/documents/ProjectsConfigurations#projects)

---

### targetDefaults

• `Optional` **targetDefaults**: `TargetDefaults`

Dependencies between different target names across all projects

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[targetDefaults](../../devkit/documents/NxJsonConfiguration#targetdefaults)

---

### tasksRunnerOptions

• `Optional` **tasksRunnerOptions**: `Object`

Available Task Runners

#### Index signature

▪ [tasksRunnerName: `string`]: { `options?`: `any` ; `runner`: `string` }

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[tasksRunnerOptions](../../devkit/documents/NxJsonConfiguration#tasksrunneroptions)

---

### version

• **version**: `number`

Version of the configuration format

#### Inherited from

[ProjectsConfigurations](../../devkit/documents/ProjectsConfigurations).[version](../../devkit/documents/ProjectsConfigurations#version)

---

### workspaceLayout

• `Optional` **workspaceLayout**: `Object`

Where new apps + libs should be placed

#### Type declaration

| Name      | Type     |
| :-------- | :------- |
| `appsDir` | `string` |
| `libsDir` | `string` |

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[workspaceLayout](../../devkit/documents/NxJsonConfiguration#workspacelayout)
