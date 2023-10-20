# Interface: Workspace

**`Deprecated`**

use ProjectsConfigurations or NxJsonConfiguration

## Hierarchy

- [`ProjectsConfigurations`](../../devkit/documents/ProjectsConfigurations)

- [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)

  ↳ **`Workspace`**

## Table of contents

### Properties

- [affected](../../devkit/documents/Workspace#affected): NxAffectedConfig
- [cacheDirectory](../../devkit/documents/Workspace#cachedirectory): string
- [cli](../../devkit/documents/Workspace#cli): Object
- [defaultBase](../../devkit/documents/Workspace#defaultbase): string
- [defaultProject](../../devkit/documents/Workspace#defaultproject): string
- [extends](../../devkit/documents/Workspace#extends): string
- [generators](../../devkit/documents/Workspace#generators): Object
- [implicitDependencies](../../devkit/documents/Workspace#implicitdependencies): ImplicitDependencyEntry<string[] | "\*">
- [installation](../../devkit/documents/Workspace#installation): NxInstallationConfiguration
- [namedInputs](../../devkit/documents/Workspace#namedinputs): Object
- [nxCloudAccessToken](../../devkit/documents/Workspace#nxcloudaccesstoken): string
- [nxCloudEncryptionKey](../../devkit/documents/Workspace#nxcloudencryptionkey): string
- [nxCloudUrl](../../devkit/documents/Workspace#nxcloudurl): string
- [parallel](../../devkit/documents/Workspace#parallel): number
- [plugins](../../devkit/documents/Workspace#plugins): PluginConfiguration[]
- [pluginsConfig](../../devkit/documents/Workspace#pluginsconfig): Record<string, Record<string, unknown>>
- [projects](../../devkit/documents/Workspace#projects): Record<string, ProjectConfiguration>
- [release](../../devkit/documents/Workspace#release): NxReleaseConfiguration
- [targetDefaults](../../devkit/documents/Workspace#targetdefaults): TargetDefaults
- [tasksRunnerOptions](../../devkit/documents/Workspace#tasksrunneroptions): Object
- [useDaemonProcess](../../devkit/documents/Workspace#usedaemonprocess): boolean
- [useInferencePlugins](../../devkit/documents/Workspace#useinferenceplugins): boolean
- [version](../../devkit/documents/Workspace#version): number
- [workspaceLayout](../../devkit/documents/Workspace#workspacelayout): Object

## Properties

### affected

• `Optional` **affected**: [`NxAffectedConfig`](../../devkit/documents/NxAffectedConfig)

Default options for `nx affected`

**`Deprecated`**

use [defaultBase](../../devkit/documents/NxJsonConfiguration#defaultbase) instead. For more information see https://nx.dev/deprecated/affected-config#affected-config

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[affected](../../devkit/documents/NxJsonConfiguration#affected)

---

### cacheDirectory

• `Optional` **cacheDirectory**: `string`

Changes the directory used by Nx to store its cache.

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[cacheDirectory](../../devkit/documents/NxJsonConfiguration#cachedirectory)

---

### cli

• `Optional` **cli**: `Object`

Default generator collection. It is used when no collection is provided.

#### Type declaration

| Name                  | Type                                                      |
| :-------------------- | :-------------------------------------------------------- |
| `defaultProjectName?` | `string`                                                  |
| `packageManager?`     | [`PackageManager`](../../devkit/documents/PackageManager) |

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[cli](../../devkit/documents/NxJsonConfiguration#cli)

---

### defaultBase

• `Optional` **defaultBase**: `string`

Default value for --base used by `nx affected` and `nx format`.

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[defaultBase](../../devkit/documents/NxJsonConfiguration#defaultbase)

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

▪ [collectionName: `string`]: \{ `[generatorName: string]`: `any`; }

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[generators](../../devkit/documents/NxJsonConfiguration#generators)

---

### implicitDependencies

• `Optional` **implicitDependencies**: [`ImplicitDependencyEntry`](../../devkit/documents/ImplicitDependencyEntry)\<`string`[] \| `"*"`\>

Map of files to projects that implicitly depend on them

**`Deprecated`**

use [namedInputs](../../devkit/documents/NxJsonConfiguration#namedinputs) instead. For more information see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies

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

### nxCloudAccessToken

• `Optional` **nxCloudAccessToken**: `string`

If specified Nx will use nx-cloud by default with the given token.
To use a different runner that accepts an access token, define it in [tasksRunnerOptions](../../devkit/documents/NxJsonConfiguration#tasksrunneroptions)

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[nxCloudAccessToken](../../devkit/documents/NxJsonConfiguration#nxcloudaccesstoken)

---

### nxCloudEncryptionKey

• `Optional` **nxCloudEncryptionKey**: `string`

Specifies the encryption key used to encrypt artifacts data before sending it to nx cloud.

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[nxCloudEncryptionKey](../../devkit/documents/NxJsonConfiguration#nxcloudencryptionkey)

---

### nxCloudUrl

• `Optional` **nxCloudUrl**: `string`

Specifies the url pointing to an instance of nx cloud. Used for remote
caching and displaying run links.

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[nxCloudUrl](../../devkit/documents/NxJsonConfiguration#nxcloudurl)

---

### parallel

• `Optional` **parallel**: `number`

Specifies how many tasks can be run in parallel.

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[parallel](../../devkit/documents/NxJsonConfiguration#parallel)

---

### plugins

• `Optional` **plugins**: [`PluginConfiguration`](../../devkit/documents/PluginConfiguration)[]

Plugins for extending the project graph

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[plugins](../../devkit/documents/NxJsonConfiguration#plugins)

---

### pluginsConfig

• `Optional` **pluginsConfig**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Configuration for Nx Plugins

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[pluginsConfig](../../devkit/documents/NxJsonConfiguration#pluginsconfig)

---

### projects

• **projects**: `Record`\<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>

Projects' projects

#### Overrides

[ProjectsConfigurations](../../devkit/documents/ProjectsConfigurations).[projects](../../devkit/documents/ProjectsConfigurations#projects)

---

### release

• `Optional` **release**: `NxReleaseConfiguration`

Configuration for `nx release` (versioning and publishing of applications and libraries)

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[release](../../devkit/documents/NxJsonConfiguration#release)

---

### targetDefaults

• `Optional` **targetDefaults**: [`TargetDefaults`](../../devkit/documents/TargetDefaults)

Dependencies between different target names across all projects

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[targetDefaults](../../devkit/documents/NxJsonConfiguration#targetdefaults)

---

### tasksRunnerOptions

• `Optional` **tasksRunnerOptions**: `Object`

Available Task Runners

#### Index signature

▪ [tasksRunnerName: `string`]: \{ `options?`: `any` ; `runner?`: `string` }

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[tasksRunnerOptions](../../devkit/documents/NxJsonConfiguration#tasksrunneroptions)

---

### useDaemonProcess

• `Optional` **useDaemonProcess**: `boolean`

Set this to false to disable the daemon.

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[useDaemonProcess](../../devkit/documents/NxJsonConfiguration#usedaemonprocess)

---

### useInferencePlugins

• `Optional` **useInferencePlugins**: `boolean`

Set this to false to disable adding inference plugins when generating new projects

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[useInferencePlugins](../../devkit/documents/NxJsonConfiguration#useinferenceplugins)

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

**`Deprecated`**

Workspace Layout will be removed in Nx v20. Pass the full `--directory` option to the generators instead.

#### Type declaration

| Name       | Type     |
| :--------- | :------- |
| `appsDir?` | `string` |
| `libsDir?` | `string` |

#### Inherited from

[NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration).[workspaceLayout](../../devkit/documents/NxJsonConfiguration#workspacelayout)
