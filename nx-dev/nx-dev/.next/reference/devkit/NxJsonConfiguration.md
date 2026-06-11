Nx.json configuration

@note: when adding properties here add them to `allowedWorkspaceExtensions` in adapter/compat.ts

## Type parameters

| Name | Type |
| :------ | :------ |
| `T` | ``"*"`` \| `string`[] |

## Hierarchy

- **`NxJsonConfiguration`**

  ↳ [`Workspace`](/docs/reference/devkit/Workspace)

## Table of contents

### Properties

- [$schema](/docs/reference/devkit/NxJsonConfiguration#$schema)
- [affected](/docs/reference/devkit/NxJsonConfiguration#affected)
- [analytics](/docs/reference/devkit/NxJsonConfiguration#analytics)
- [cacheDirectory](/docs/reference/devkit/NxJsonConfiguration#cachedirectory)
- [cli](/docs/reference/devkit/NxJsonConfiguration#cli)
- [defaultBase](/docs/reference/devkit/NxJsonConfiguration#defaultbase)
- [defaultProject](/docs/reference/devkit/NxJsonConfiguration#defaultproject)
- [extends](/docs/reference/devkit/NxJsonConfiguration#extends)
- [generators](/docs/reference/devkit/NxJsonConfiguration#generators)
- [implicitDependencies](/docs/reference/devkit/NxJsonConfiguration#implicitdependencies)
- [installation](/docs/reference/devkit/NxJsonConfiguration#installation)
- [maxCacheSize](/docs/reference/devkit/NxJsonConfiguration#maxcachesize)
- [namedInputs](/docs/reference/devkit/NxJsonConfiguration#namedinputs)
- [neverConnectToCloud](/docs/reference/devkit/NxJsonConfiguration#neverconnecttocloud)
- [nxCloudAccessToken](/docs/reference/devkit/NxJsonConfiguration#nxcloudaccesstoken)
- [nxCloudEncryptionKey](/docs/reference/devkit/NxJsonConfiguration#nxcloudencryptionkey)
- [nxCloudId](/docs/reference/devkit/NxJsonConfiguration#nxcloudid)
- [nxCloudUrl](/docs/reference/devkit/NxJsonConfiguration#nxcloudurl)
- [parallel](/docs/reference/devkit/NxJsonConfiguration#parallel)
- [plugins](/docs/reference/devkit/NxJsonConfiguration#plugins)
- [pluginsConfig](/docs/reference/devkit/NxJsonConfiguration#pluginsconfig)
- [release](/docs/reference/devkit/NxJsonConfiguration#release)
- [sync](/docs/reference/devkit/NxJsonConfiguration#sync)
- [targetDefaults](/docs/reference/devkit/NxJsonConfiguration#targetdefaults)
- [tasksRunnerOptions](/docs/reference/devkit/NxJsonConfiguration#tasksrunneroptions)
- [tui](/docs/reference/devkit/NxJsonConfiguration#tui)
- [useDaemonProcess](/docs/reference/devkit/NxJsonConfiguration#usedaemonprocess)
- [useInferencePlugins](/docs/reference/devkit/NxJsonConfiguration#useinferenceplugins)
- [workspaceLayout](/docs/reference/devkit/NxJsonConfiguration#workspacelayout)

## Properties

### $schema

• `Optional` **$schema**: `string`

___

### affected

• `Optional` **affected**: [`NxAffectedConfig`](/docs/reference/devkit/NxAffectedConfig)

Default options for `nx affected`

**`Deprecated`**

use [defaultBase](/docs/reference/devkit/NxJsonConfiguration#defaultbase) instead. For more information see https://nx.dev/deprecated/affected-config#affected-config

___

### analytics

• `Optional` **analytics**: `boolean`

Set this to true to allow Nx to collect usage analytics.

___

### cacheDirectory

• `Optional` **cacheDirectory**: `string`

Changes the directory used by Nx to store its cache.

___

### cli

• `Optional` **cli**: `Object`

Default generator collection. It is used when no collection is provided.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `defaultProjectName?` | `string` |
| `packageManager?` | [`PackageManager`](/docs/reference/devkit/PackageManager) |

___

### defaultBase

• `Optional` **defaultBase**: `string`

Default value for --base used by `nx affected` and `nx format`.

___

### defaultProject

• `Optional` **defaultProject**: `string`

Default project. When project isn't provided, the default project
will be used. Convenient for small workspaces with one main application.

___

### extends

• `Optional` **extends**: `string`

Optional (additional) Nx.json configuration file which becomes a base for this one

___

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

▪ [collectionName: `string`]: \{ `[generatorName: string]`: `any`;  }

___

### implicitDependencies

• `Optional` **implicitDependencies**: [`ImplicitDependencyEntry`](/docs/reference/devkit/ImplicitDependencyEntry)\<`T`\>

Map of files to projects that implicitly depend on them

**`Deprecated`**

use [namedInputs](/docs/reference/devkit/NxJsonConfiguration#namedinputs) instead. For more information see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies

___

### installation

• `Optional` **installation**: `NxInstallationConfiguration`

Configures the Nx installation for a repo. Useful for maintaining  a separate
set of dependencies for Nx + Plugins compared to the base package.json, but also
useful for workspaces that don't have a root package.json + node_modules.

___

### maxCacheSize

• `Optional` **maxCacheSize**: `string`

Sets the maximum size of the local cache. Accepts a number followed by a unit (e.g. 100MB). Accepted units are B, KB, MB, and GB.

___

### namedInputs

• `Optional` **namedInputs**: `Object`

Named inputs targets can refer to reduce duplication

#### Index signature

▪ [inputName: `string`]: (`string` \| `InputDefinition`)[]

___

### neverConnectToCloud

• `Optional` **neverConnectToCloud**: `boolean`

Setting this to true will cause all attempts to setup your workspace to Nx Cloud to fail.
This value does not prevent using Nx Cloud if already connected.
Use NX_NO_CLOUD=true env var or the `--no-cloud` arg to prevent using Nx Cloud when running commands.

___

### nxCloudAccessToken

• `Optional` **nxCloudAccessToken**: `string`

If specified Nx will use nx-cloud by default with the given token.
To use a different runner that accepts an access token, define it in [tasksRunnerOptions](/docs/reference/devkit/NxJsonConfiguration#tasksrunneroptions)

___

### nxCloudEncryptionKey

• `Optional` **nxCloudEncryptionKey**: `string`

Specifies the encryption key used to encrypt artifacts data before sending it to nx cloud.

___

### nxCloudId

• `Optional` **nxCloudId**: `string`

If specified Nx will use nx-cloud by default with the given cloud id.
To use a different runner that accepts a cloud id, define it in [tasksRunnerOptions](/docs/reference/devkit/NxJsonConfiguration#tasksrunneroptions)

___

### nxCloudUrl

• `Optional` **nxCloudUrl**: `string`

Specifies the url pointing to an instance of nx cloud. Used for remote
caching and displaying run links.

___

### parallel

• `Optional` **parallel**: `number`

Specifies how many tasks can be run in parallel.

___

### plugins

• `Optional` **plugins**: [`PluginConfiguration`](/docs/reference/devkit/PluginConfiguration)[]

Plugins for extending the project graph

___

### pluginsConfig

• `Optional` **pluginsConfig**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Configuration for Nx Plugins

___

### release

• `Optional` **release**: `NxReleaseConfiguration`

Configuration for `nx release` (versioning and publishing of applications and libraries)

___

### sync

• `Optional` **sync**: `NxSyncConfiguration`

Configuration for the `nx sync` command.

___

### targetDefaults

• `Optional` **targetDefaults**: [`TargetDefaults`](/docs/reference/devkit/TargetDefaults)

Dependencies between different target names across all projects

___

### tasksRunnerOptions

• `Optional` **tasksRunnerOptions**: `Object`

**`Deprecated`**

Custom task runners will be replaced by a new API starting with Nx 21. More info: https://nx.dev/deprecated/custom-tasks-runner
Available Task Runners for Nx to use

#### Index signature

▪ [tasksRunnerName: `string`]: \{ `options?`: `any` ; `runner?`: `string`  }

___

### tui

• `Optional` **tui**: `Object`

Settings for the Nx Terminal User Interface (TUI)

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `autoExit?` | `number` \| `boolean` | Whether to exit the TUI automatically after all tasks finish. - If set to `true`, the TUI will exit immediately. - If set to `false` the TUI will not automatically exit. - If set to a number, an interruptible countdown popup will be shown for that many seconds before the TUI exits. |
| `enabled?` | `boolean` | Whether to enable the TUI whenever possible (based on the current environment and terminal). |
| `suppressHints?` | `boolean` | Whether to suppress hint popups that provide guidance for unhandled keys. Defaults to `false` (hints are shown). |

___

### useDaemonProcess

• `Optional` **useDaemonProcess**: `boolean`

Set this to false to disable the daemon.

___

### useInferencePlugins

• `Optional` **useInferencePlugins**: `boolean`

Set this to false to disable adding inference plugins when generating new projects

___

### workspaceLayout

• `Optional` **workspaceLayout**: `Object`

Where new apps + libs should be placed

#### Type declaration

| Name | Type |
| :------ | :------ |
| `appsDir?` | `string` |
| `libsDir?` | `string` |
