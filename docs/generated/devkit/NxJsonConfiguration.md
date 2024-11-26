# Interface: NxJsonConfiguration\<T\>

Nx.json configuration

## Type parameters

| Name | Type                |
| :--- | :------------------ |
| `T`  | `"*"` \| `string`[] |

## Hierarchy

- **`NxJsonConfiguration`**

  ↳ [`Workspace`](../../devkit/documents/Workspace)

## Table of contents

### Properties

- [affected](../../devkit/documents/NxJsonConfiguration#affected): NxAffectedConfig
- [cacheDirectory](../../devkit/documents/NxJsonConfiguration#cachedirectory): string
- [cli](../../devkit/documents/NxJsonConfiguration#cli): Object
- [defaultBase](../../devkit/documents/NxJsonConfiguration#defaultbase): string
- [defaultProject](../../devkit/documents/NxJsonConfiguration#defaultproject): string
- [extends](../../devkit/documents/NxJsonConfiguration#extends): string
- [generators](../../devkit/documents/NxJsonConfiguration#generators): Object
- [implicitDependencies](../../devkit/documents/NxJsonConfiguration#implicitdependencies): ImplicitDependencyEntry<T>
- [installation](../../devkit/documents/NxJsonConfiguration#installation): NxInstallationConfiguration
- [namedInputs](../../devkit/documents/NxJsonConfiguration#namedinputs): Object
- [neverConnectToCloud](../../devkit/documents/NxJsonConfiguration#neverconnecttocloud): boolean
- [nxCloudAccessToken](../../devkit/documents/NxJsonConfiguration#nxcloudaccesstoken): string
- [nxCloudEncryptionKey](../../devkit/documents/NxJsonConfiguration#nxcloudencryptionkey): string
- [nxCloudId](../../devkit/documents/NxJsonConfiguration#nxcloudid): string
- [nxCloudUrl](../../devkit/documents/NxJsonConfiguration#nxcloudurl): string
- [parallel](../../devkit/documents/NxJsonConfiguration#parallel): number
- [plugins](../../devkit/documents/NxJsonConfiguration#plugins): PluginConfiguration[]
- [pluginsConfig](../../devkit/documents/NxJsonConfiguration#pluginsconfig): Record<string, Record<string, unknown>>
- [release](../../devkit/documents/NxJsonConfiguration#release): NxReleaseConfiguration
- [sync](../../devkit/documents/NxJsonConfiguration#sync): NxSyncConfiguration
- [targetDefaults](../../devkit/documents/NxJsonConfiguration#targetdefaults): TargetDefaults
- [tasksRunnerOptions](../../devkit/documents/NxJsonConfiguration#tasksrunneroptions): Object
- [useDaemonProcess](../../devkit/documents/NxJsonConfiguration#usedaemonprocess): boolean
- [useInferencePlugins](../../devkit/documents/NxJsonConfiguration#useinferenceplugins): boolean
- [useLegacyCache](../../devkit/documents/NxJsonConfiguration#uselegacycache): boolean
- [workspaceLayout](../../devkit/documents/NxJsonConfiguration#workspacelayout): Object

## Properties

### affected

• `Optional` **affected**: [`NxAffectedConfig`](../../devkit/documents/NxAffectedConfig)

Default options for `nx affected`

**`Deprecated`**

use [defaultBase](../../devkit/documents/NxJsonConfiguration#defaultbase) instead. For more information see https://nx.dev/deprecated/affected-config#affected-config

---

### cacheDirectory

• `Optional` **cacheDirectory**: `string`

Changes the directory used by Nx to store its cache.

---

### cli

• `Optional` **cli**: `Object`

Default generator collection. It is used when no collection is provided.

#### Type declaration

| Name                  | Type                                                      |
| :-------------------- | :-------------------------------------------------------- |
| `defaultProjectName?` | `string`                                                  |
| `packageManager?`     | [`PackageManager`](../../devkit/documents/PackageManager) |

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

• `Optional` **implicitDependencies**: [`ImplicitDependencyEntry`](../../devkit/documents/ImplicitDependencyEntry)\<`T`\>

Map of files to projects that implicitly depend on them

**`Deprecated`**

use [namedInputs](../../devkit/documents/NxJsonConfiguration#namedinputs) instead. For more information see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies

---

### installation

• `Optional` **installation**: `NxInstallationConfiguration`

Configures the Nx installation for a repo. Useful for maintaining a separate
set of dependencies for Nx + Plugins compared to the base package.json, but also
useful for workspaces that don't have a root package.json + node_modules.

---

### namedInputs

• `Optional` **namedInputs**: `Object`

Named inputs targets can refer to reduce duplication

#### Index signature

▪ [inputName: `string`]: (`string` \| `InputDefinition`)[]

---

### neverConnectToCloud

• `Optional` **neverConnectToCloud**: `boolean`

Set this to false to disable connection to Nx Cloud

---

### nxCloudAccessToken

• `Optional` **nxCloudAccessToken**: `string`

If specified Nx will use nx-cloud by default with the given token.
To use a different runner that accepts an access token, define it in [tasksRunnerOptions](../../devkit/documents/NxJsonConfiguration#tasksrunneroptions)

---

### nxCloudEncryptionKey

• `Optional` **nxCloudEncryptionKey**: `string`

Specifies the encryption key used to encrypt artifacts data before sending it to nx cloud.

---

### nxCloudId

• `Optional` **nxCloudId**: `string`

If specified Nx will use nx-cloud by default with the given cloud id.
To use a different runner that accepts a cloud id, define it in [tasksRunnerOptions](../../devkit/documents/NxJsonConfiguration#tasksrunneroptions)

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

• `Optional` **plugins**: [`PluginConfiguration`](../../devkit/documents/PluginConfiguration)[]

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

• `Optional` **targetDefaults**: [`TargetDefaults`](../../devkit/documents/TargetDefaults)

Dependencies between different target names across all projects

---

### tasksRunnerOptions

• `Optional` **tasksRunnerOptions**: `Object`

**`Deprecated`**

Custom task runners will no longer be supported in Nx 21. Use Nx Cloud or Nx Powerpack instead.
Available Task Runners for Nx to use

#### Index signature

▪ [tasksRunnerName: `string`]: \{ `options?`: `any` ; `runner?`: `string` }

---

### useDaemonProcess

• `Optional` **useDaemonProcess**: `boolean`

Set this to false to disable the daemon.

---

### useInferencePlugins

• `Optional` **useInferencePlugins**: `boolean`

Set this to false to disable adding inference plugins when generating new projects

---

### useLegacyCache

• `Optional` **useLegacyCache**: `boolean`

Use the legacy file system cache instead of the db cache

---

### workspaceLayout

• `Optional` **workspaceLayout**: `Object`

Where new apps + libs should be placed

#### Type declaration

| Name       | Type     |
| :--------- | :------- |
| `appsDir?` | `string` |
| `libsDir?` | `string` |
