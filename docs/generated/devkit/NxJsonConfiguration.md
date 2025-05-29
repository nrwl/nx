# Interface: NxJsonConfiguration\<T\>

Nx.json configuration

## Type parameters

| Name | Type                |
| :--- | :------------------ |
| `T`  | `"*"` \| `string`[] |

## Hierarchy

- **`NxJsonConfiguration`**

  ↳ [`Workspace`](/reference/core-api/devkit/documents/Workspace)

## Table of contents

### Properties

- [$schema](/reference/core-api/devkit/documents/NxJsonConfiguration#$schema): string
- [affected](/reference/core-api/devkit/documents/NxJsonConfiguration#affected): NxAffectedConfig
- [cacheDirectory](/reference/core-api/devkit/documents/NxJsonConfiguration#cachedirectory): string
- [cli](/reference/core-api/devkit/documents/NxJsonConfiguration#cli): Object
- [defaultBase](/reference/core-api/devkit/documents/NxJsonConfiguration#defaultbase): string
- [defaultProject](/reference/core-api/devkit/documents/NxJsonConfiguration#defaultproject): string
- [extends](/reference/core-api/devkit/documents/NxJsonConfiguration#extends): string
- [generators](/reference/core-api/devkit/documents/NxJsonConfiguration#generators): Object
- [implicitDependencies](/reference/core-api/devkit/documents/NxJsonConfiguration#implicitdependencies): ImplicitDependencyEntry<T>
- [installation](/reference/core-api/devkit/documents/NxJsonConfiguration#installation): NxInstallationConfiguration
- [maxCacheSize](/reference/core-api/devkit/documents/NxJsonConfiguration#maxcachesize): string
- [namedInputs](/reference/core-api/devkit/documents/NxJsonConfiguration#namedinputs): Object
- [neverConnectToCloud](/reference/core-api/devkit/documents/NxJsonConfiguration#neverconnecttocloud): boolean
- [nxCloudAccessToken](/reference/core-api/devkit/documents/NxJsonConfiguration#nxcloudaccesstoken): string
- [nxCloudEncryptionKey](/reference/core-api/devkit/documents/NxJsonConfiguration#nxcloudencryptionkey): string
- [nxCloudId](/reference/core-api/devkit/documents/NxJsonConfiguration#nxcloudid): string
- [nxCloudUrl](/reference/core-api/devkit/documents/NxJsonConfiguration#nxcloudurl): string
- [parallel](/reference/core-api/devkit/documents/NxJsonConfiguration#parallel): number
- [plugins](/reference/core-api/devkit/documents/NxJsonConfiguration#plugins): PluginConfiguration[]
- [pluginsConfig](/reference/core-api/devkit/documents/NxJsonConfiguration#pluginsconfig): Record<string, Record<string, unknown>>
- [release](/reference/core-api/devkit/documents/NxJsonConfiguration#release): NxReleaseConfiguration
- [sync](/reference/core-api/devkit/documents/NxJsonConfiguration#sync): NxSyncConfiguration
- [targetDefaults](/reference/core-api/devkit/documents/NxJsonConfiguration#targetdefaults): TargetDefaults
- [tasksRunnerOptions](/reference/core-api/devkit/documents/NxJsonConfiguration#tasksrunneroptions): Object
- [tui](/reference/core-api/devkit/documents/NxJsonConfiguration#tui): Object
- [useDaemonProcess](/reference/core-api/devkit/documents/NxJsonConfiguration#usedaemonprocess): boolean
- [useInferencePlugins](/reference/core-api/devkit/documents/NxJsonConfiguration#useinferenceplugins): boolean
- [workspaceLayout](/reference/core-api/devkit/documents/NxJsonConfiguration#workspacelayout): Object

## Properties

### $schema

• `Optional` **$schema**: `string`

---

### affected

• `Optional` **affected**: [`NxAffectedConfig`](/reference/core-api/devkit/documents/NxAffectedConfig)

Default options for `nx affected`

**`Deprecated`**

use [defaultBase](/reference/core-api/devkit/documents/NxJsonConfiguration#defaultbase) instead. For more information see https://nx.dev/deprecated/affected-config#affected-config

---

### cacheDirectory

• `Optional` **cacheDirectory**: `string`

Changes the directory used by Nx to store its cache.

---

### cli

• `Optional` **cli**: `Object`

Default generator collection. It is used when no collection is provided.

#### Type declaration

| Name                  | Type                                                                    |
| :-------------------- | :---------------------------------------------------------------------- |
| `defaultProjectName?` | `string`                                                                |
| `packageManager?`     | [`PackageManager`](/reference/core-api/devkit/documents/PackageManager) |

---

### defaultBase

• `Optional` **defaultBase**: `string`

Default value for --base used by `nx affected` and `nx format`.

---

### defaultProject

• `Optional` **defaultProject**: `string`

Default project. When project isn't provided, the default project
will be used. Convenient for small workspaces with one main application.

---

### extends

• `Optional` **extends**: `string`

Optional (additional) Nx.json configuration file which becomes a base for this one

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

---

### implicitDependencies

• `Optional` **implicitDependencies**: [`ImplicitDependencyEntry`](/reference/core-api/devkit/documents/ImplicitDependencyEntry)\<`T`\>

Map of files to projects that implicitly depend on them

**`Deprecated`**

use [namedInputs](/reference/core-api/devkit/documents/NxJsonConfiguration#namedinputs) instead. For more information see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies

---

### installation

• `Optional` **installation**: `NxInstallationConfiguration`

Configures the Nx installation for a repo. Useful for maintaining a separate
set of dependencies for Nx + Plugins compared to the base package.json, but also
useful for workspaces that don't have a root package.json + node_modules.

---

### maxCacheSize

• `Optional` **maxCacheSize**: `string`

Sets the maximum size of the local cache. Accepts a number followed by a unit (e.g. 100MB). Accepted units are B, KB, MB, and GB.

---

### namedInputs

• `Optional` **namedInputs**: `Object`

Named inputs targets can refer to reduce duplication

#### Index signature

▪ [inputName: `string`]: (`string` \| `InputDefinition`)[]

---

### neverConnectToCloud

• `Optional` **neverConnectToCloud**: `boolean`

Set this to true to disable connection to Nx Cloud

---

### nxCloudAccessToken

• `Optional` **nxCloudAccessToken**: `string`

If specified Nx will use nx-cloud by default with the given token.
To use a different runner that accepts an access token, define it in [tasksRunnerOptions](/reference/core-api/devkit/documents/NxJsonConfiguration#tasksrunneroptions)

---

### nxCloudEncryptionKey

• `Optional` **nxCloudEncryptionKey**: `string`

Specifies the encryption key used to encrypt artifacts data before sending it to nx cloud.

---

### nxCloudId

• `Optional` **nxCloudId**: `string`

If specified Nx will use nx-cloud by default with the given cloud id.
To use a different runner that accepts a cloud id, define it in [tasksRunnerOptions](/reference/core-api/devkit/documents/NxJsonConfiguration#tasksrunneroptions)

---

### nxCloudUrl

• `Optional` **nxCloudUrl**: `string`

Specifies the url pointing to an instance of nx cloud. Used for remote
caching and displaying run links.

---

### parallel

• `Optional` **parallel**: `number`

Specifies how many tasks can be run in parallel.

---

### plugins

• `Optional` **plugins**: [`PluginConfiguration`](/reference/core-api/devkit/documents/PluginConfiguration)[]

Plugins for extending the project graph

---

### pluginsConfig

• `Optional` **pluginsConfig**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Configuration for Nx Plugins

---

### release

• `Optional` **release**: `NxReleaseConfiguration`

Configuration for `nx release` (versioning and publishing of applications and libraries)

---

### sync

• `Optional` **sync**: `NxSyncConfiguration`

Configuration for the `nx sync` command.

---

### targetDefaults

• `Optional` **targetDefaults**: [`TargetDefaults`](/reference/core-api/devkit/documents/TargetDefaults)

Dependencies between different target names across all projects

---

### tasksRunnerOptions

• `Optional` **tasksRunnerOptions**: `Object`

**`Deprecated`**

Custom task runners will be replaced by a new API starting with Nx 21. More info: https://nx.dev/deprecated/custom-tasks-runner
Available Task Runners for Nx to use

#### Index signature

▪ [tasksRunnerName: `string`]: \{ `options?`: `any` ; `runner?`: `string` }

---

### tui

• `Optional` **tui**: `Object`

Settings for the Nx Terminal User Interface (TUI)

#### Type declaration

| Name        | Type                  | Description                                                                                                                                                                                                                                                                                |
| :---------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autoExit?` | `number` \| `boolean` | Whether to exit the TUI automatically after all tasks finish. - If set to `true`, the TUI will exit immediately. - If set to `false` the TUI will not automatically exit. - If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits. |
| `enabled?`  | `boolean`             | Whether to enable the TUI whenever possible (based on the current environment and terminal).                                                                                                                                                                                               |

---

### useDaemonProcess

• `Optional` **useDaemonProcess**: `boolean`

Set this to false to disable the daemon.

---

### useInferencePlugins

• `Optional` **useInferencePlugins**: `boolean`

Set this to false to disable adding inference plugins when generating new projects

---

### workspaceLayout

• `Optional` **workspaceLayout**: `Object`

Where new apps + libs should be placed

#### Type declaration

| Name       | Type     |
| :--------- | :------- |
| `appsDir?` | `string` |
| `libsDir?` | `string` |
