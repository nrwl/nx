# Interface: Workspace

**`Deprecated`**

use ProjectsConfigurations or NxJsonConfiguration

## Hierarchy

- [`ProjectsConfigurations`](/reference/core-api/devkit/documents/ProjectsConfigurations)

- [`NxJsonConfiguration`](/reference/core-api/devkit/documents/NxJsonConfiguration)

  ↳ **`Workspace`**

## Table of contents

### Properties

- [$schema](/reference/core-api/devkit/documents/Workspace#$schema): string
- [affected](/reference/core-api/devkit/documents/Workspace#affected): NxAffectedConfig
- [cacheDirectory](/reference/core-api/devkit/documents/Workspace#cachedirectory): string
- [cli](/reference/core-api/devkit/documents/Workspace#cli): Object
- [defaultBase](/reference/core-api/devkit/documents/Workspace#defaultbase): string
- [defaultProject](/reference/core-api/devkit/documents/Workspace#defaultproject): string
- [extends](/reference/core-api/devkit/documents/Workspace#extends): string
- [generators](/reference/core-api/devkit/documents/Workspace#generators): Object
- [implicitDependencies](/reference/core-api/devkit/documents/Workspace#implicitdependencies): ImplicitDependencyEntry<string[] | "\*">
- [installation](/reference/core-api/devkit/documents/Workspace#installation): NxInstallationConfiguration
- [maxCacheSize](/reference/core-api/devkit/documents/Workspace#maxcachesize): string
- [namedInputs](/reference/core-api/devkit/documents/Workspace#namedinputs): Object
- [neverConnectToCloud](/reference/core-api/devkit/documents/Workspace#neverconnecttocloud): boolean
- [nxCloudAccessToken](/reference/core-api/devkit/documents/Workspace#nxcloudaccesstoken): string
- [nxCloudEncryptionKey](/reference/core-api/devkit/documents/Workspace#nxcloudencryptionkey): string
- [nxCloudId](/reference/core-api/devkit/documents/Workspace#nxcloudid): string
- [nxCloudUrl](/reference/core-api/devkit/documents/Workspace#nxcloudurl): string
- [parallel](/reference/core-api/devkit/documents/Workspace#parallel): number
- [plugins](/reference/core-api/devkit/documents/Workspace#plugins): PluginConfiguration[]
- [pluginsConfig](/reference/core-api/devkit/documents/Workspace#pluginsconfig): Record<string, Record<string, unknown>>
- [projects](/reference/core-api/devkit/documents/Workspace#projects): Record<string, ProjectConfiguration>
- [release](/reference/core-api/devkit/documents/Workspace#release): NxReleaseConfiguration
- [sync](/reference/core-api/devkit/documents/Workspace#sync): NxSyncConfiguration
- [targetDefaults](/reference/core-api/devkit/documents/Workspace#targetdefaults): TargetDefaults
- [tasksRunnerOptions](/reference/core-api/devkit/documents/Workspace#tasksrunneroptions): Object
- [tui](/reference/core-api/devkit/documents/Workspace#tui): Object
- [useDaemonProcess](/reference/core-api/devkit/documents/Workspace#usedaemonprocess): boolean
- [useInferencePlugins](/reference/core-api/devkit/documents/Workspace#useinferenceplugins): boolean
- [version](/reference/core-api/devkit/documents/Workspace#version): number
- [workspaceLayout](/reference/core-api/devkit/documents/Workspace#workspacelayout): Object

## Properties

### $schema

• `Optional` **$schema**: `string`

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[$schema](/reference/core-api/devkit/documents/NxJsonConfiguration#$schema)

---

### affected

• `Optional` **affected**: [`NxAffectedConfig`](/reference/core-api/devkit/documents/NxAffectedConfig)

Default options for `nx affected`

**`Deprecated`**

use [defaultBase](/reference/core-api/devkit/documents/NxJsonConfiguration#defaultbase) instead. For more information see https://nx.dev/deprecated/affected-config#affected-config

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[affected](/reference/core-api/devkit/documents/NxJsonConfiguration#affected)

---

### cacheDirectory

• `Optional` **cacheDirectory**: `string`

Changes the directory used by Nx to store its cache.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[cacheDirectory](/reference/core-api/devkit/documents/NxJsonConfiguration#cachedirectory)

---

### cli

• `Optional` **cli**: `Object`

Default generator collection. It is used when no collection is provided.

#### Type declaration

| Name                  | Type                                                                    |
| :-------------------- | :---------------------------------------------------------------------- |
| `defaultProjectName?` | `string`                                                                |
| `packageManager?`     | [`PackageManager`](/reference/core-api/devkit/documents/PackageManager) |

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[cli](/reference/core-api/devkit/documents/NxJsonConfiguration#cli)

---

### defaultBase

• `Optional` **defaultBase**: `string`

Default value for --base used by `nx affected` and `nx format`.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[defaultBase](/reference/core-api/devkit/documents/NxJsonConfiguration#defaultbase)

---

### defaultProject

• `Optional` **defaultProject**: `string`

Default project. When project isn't provided, the default project
will be used. Convenient for small workspaces with one main application.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[defaultProject](/reference/core-api/devkit/documents/NxJsonConfiguration#defaultproject)

---

### extends

• `Optional` **extends**: `string`

Optional (additional) Nx.json configuration file which becomes a base for this one

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[extends](/reference/core-api/devkit/documents/NxJsonConfiguration#extends)

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

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[generators](/reference/core-api/devkit/documents/NxJsonConfiguration#generators)

---

### implicitDependencies

• `Optional` **implicitDependencies**: [`ImplicitDependencyEntry`](/reference/core-api/devkit/documents/ImplicitDependencyEntry)\<`string`[] \| `"*"`\>

Map of files to projects that implicitly depend on them

**`Deprecated`**

use [namedInputs](/reference/core-api/devkit/documents/NxJsonConfiguration#namedinputs) instead. For more information see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[implicitDependencies](/reference/core-api/devkit/documents/NxJsonConfiguration#implicitdependencies)

---

### installation

• `Optional` **installation**: `NxInstallationConfiguration`

Configures the Nx installation for a repo. Useful for maintaining a separate
set of dependencies for Nx + Plugins compared to the base package.json, but also
useful for workspaces that don't have a root package.json + node_modules.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[installation](/reference/core-api/devkit/documents/NxJsonConfiguration#installation)

---

### maxCacheSize

• `Optional` **maxCacheSize**: `string`

Sets the maximum size of the local cache. Accepts a number followed by a unit (e.g. 100MB). Accepted units are B, KB, MB, and GB.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[maxCacheSize](/reference/core-api/devkit/documents/NxJsonConfiguration#maxcachesize)

---

### namedInputs

• `Optional` **namedInputs**: `Object`

Named inputs targets can refer to reduce duplication

#### Index signature

▪ [inputName: `string`]: (`string` \| `InputDefinition`)[]

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[namedInputs](/reference/core-api/devkit/documents/NxJsonConfiguration#namedinputs)

---

### neverConnectToCloud

• `Optional` **neverConnectToCloud**: `boolean`

Set this to true to disable connection to Nx Cloud

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[neverConnectToCloud](/reference/core-api/devkit/documents/NxJsonConfiguration#neverconnecttocloud)

---

### nxCloudAccessToken

• `Optional` **nxCloudAccessToken**: `string`

If specified Nx will use nx-cloud by default with the given token.
To use a different runner that accepts an access token, define it in [tasksRunnerOptions](/reference/core-api/devkit/documents/NxJsonConfiguration#tasksrunneroptions)

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[nxCloudAccessToken](/reference/core-api/devkit/documents/NxJsonConfiguration#nxcloudaccesstoken)

---

### nxCloudEncryptionKey

• `Optional` **nxCloudEncryptionKey**: `string`

Specifies the encryption key used to encrypt artifacts data before sending it to nx cloud.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[nxCloudEncryptionKey](/reference/core-api/devkit/documents/NxJsonConfiguration#nxcloudencryptionkey)

---

### nxCloudId

• `Optional` **nxCloudId**: `string`

If specified Nx will use nx-cloud by default with the given cloud id.
To use a different runner that accepts a cloud id, define it in [tasksRunnerOptions](/reference/core-api/devkit/documents/NxJsonConfiguration#tasksrunneroptions)

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[nxCloudId](/reference/core-api/devkit/documents/NxJsonConfiguration#nxcloudid)

---

### nxCloudUrl

• `Optional` **nxCloudUrl**: `string`

Specifies the url pointing to an instance of nx cloud. Used for remote
caching and displaying run links.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[nxCloudUrl](/reference/core-api/devkit/documents/NxJsonConfiguration#nxcloudurl)

---

### parallel

• `Optional` **parallel**: `number`

Specifies how many tasks can be run in parallel.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[parallel](/reference/core-api/devkit/documents/NxJsonConfiguration#parallel)

---

### plugins

• `Optional` **plugins**: [`PluginConfiguration`](/reference/core-api/devkit/documents/PluginConfiguration)[]

Plugins for extending the project graph

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[plugins](/reference/core-api/devkit/documents/NxJsonConfiguration#plugins)

---

### pluginsConfig

• `Optional` **pluginsConfig**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Configuration for Nx Plugins

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[pluginsConfig](/reference/core-api/devkit/documents/NxJsonConfiguration#pluginsconfig)

---

### projects

• **projects**: `Record`\<`string`, [`ProjectConfiguration`](/reference/core-api/devkit/documents/ProjectConfiguration)\>

Projects' projects

#### Overrides

[ProjectsConfigurations](/reference/core-api/devkit/documents/ProjectsConfigurations).[projects](/reference/core-api/devkit/documents/ProjectsConfigurations#projects)

---

### release

• `Optional` **release**: `NxReleaseConfiguration`

Configuration for `nx release` (versioning and publishing of applications and libraries)

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[release](/reference/core-api/devkit/documents/NxJsonConfiguration#release)

---

### sync

• `Optional` **sync**: `NxSyncConfiguration`

Configuration for the `nx sync` command.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[sync](/reference/core-api/devkit/documents/NxJsonConfiguration#sync)

---

### targetDefaults

• `Optional` **targetDefaults**: [`TargetDefaults`](/reference/core-api/devkit/documents/TargetDefaults)

Dependencies between different target names across all projects

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[targetDefaults](/reference/core-api/devkit/documents/NxJsonConfiguration#targetdefaults)

---

### tasksRunnerOptions

• `Optional` **tasksRunnerOptions**: `Object`

**`Deprecated`**

Custom task runners will be replaced by a new API starting with Nx 21. More info: https://nx.dev/deprecated/custom-tasks-runner
Available Task Runners for Nx to use

#### Index signature

▪ [tasksRunnerName: `string`]: \{ `options?`: `any` ; `runner?`: `string` }

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[tasksRunnerOptions](/reference/core-api/devkit/documents/NxJsonConfiguration#tasksrunneroptions)

---

### tui

• `Optional` **tui**: `Object`

Settings for the Nx Terminal User Interface (TUI)

#### Type declaration

| Name        | Type                  | Description                                                                                                                                                                                                                                                                                |
| :---------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autoExit?` | `number` \| `boolean` | Whether to exit the TUI automatically after all tasks finish. - If set to `true`, the TUI will exit immediately. - If set to `false` the TUI will not automatically exit. - If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits. |
| `enabled?`  | `boolean`             | Whether to enable the TUI whenever possible (based on the current environment and terminal).                                                                                                                                                                                               |

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[tui](/reference/core-api/devkit/documents/NxJsonConfiguration#tui)

---

### useDaemonProcess

• `Optional` **useDaemonProcess**: `boolean`

Set this to false to disable the daemon.

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[useDaemonProcess](/reference/core-api/devkit/documents/NxJsonConfiguration#usedaemonprocess)

---

### useInferencePlugins

• `Optional` **useInferencePlugins**: `boolean`

Set this to false to disable adding inference plugins when generating new projects

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[useInferencePlugins](/reference/core-api/devkit/documents/NxJsonConfiguration#useinferenceplugins)

---

### version

• **version**: `number`

Version of the configuration format

#### Inherited from

[ProjectsConfigurations](/reference/core-api/devkit/documents/ProjectsConfigurations).[version](/reference/core-api/devkit/documents/ProjectsConfigurations#version)

---

### workspaceLayout

• `Optional` **workspaceLayout**: `Object`

Where new apps + libs should be placed

#### Type declaration

| Name       | Type     |
| :--------- | :------- |
| `appsDir?` | `string` |
| `libsDir?` | `string` |

#### Inherited from

[NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration).[workspaceLayout](/reference/core-api/devkit/documents/NxJsonConfiguration#workspacelayout)
