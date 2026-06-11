**`Deprecated`**

use ProjectsConfigurations or NxJsonConfiguration

## Hierarchy

- [`ProjectsConfigurations`](/docs/reference/devkit/ProjectsConfigurations)

- [`NxJsonConfiguration`](/docs/reference/devkit/NxJsonConfiguration)

  ↳ **`Workspace`**

## Table of contents

### Properties

- [$schema](/docs/reference/devkit/Workspace#$schema)
- [affected](/docs/reference/devkit/Workspace#affected)
- [analytics](/docs/reference/devkit/Workspace#analytics)
- [cacheDirectory](/docs/reference/devkit/Workspace#cachedirectory)
- [cli](/docs/reference/devkit/Workspace#cli)
- [defaultBase](/docs/reference/devkit/Workspace#defaultbase)
- [defaultProject](/docs/reference/devkit/Workspace#defaultproject)
- [extends](/docs/reference/devkit/Workspace#extends)
- [generators](/docs/reference/devkit/Workspace#generators)
- [implicitDependencies](/docs/reference/devkit/Workspace#implicitdependencies)
- [installation](/docs/reference/devkit/Workspace#installation)
- [maxCacheSize](/docs/reference/devkit/Workspace#maxcachesize)
- [namedInputs](/docs/reference/devkit/Workspace#namedinputs)
- [neverConnectToCloud](/docs/reference/devkit/Workspace#neverconnecttocloud)
- [nxCloudAccessToken](/docs/reference/devkit/Workspace#nxcloudaccesstoken)
- [nxCloudEncryptionKey](/docs/reference/devkit/Workspace#nxcloudencryptionkey)
- [nxCloudId](/docs/reference/devkit/Workspace#nxcloudid)
- [nxCloudUrl](/docs/reference/devkit/Workspace#nxcloudurl)
- [parallel](/docs/reference/devkit/Workspace#parallel)
- [plugins](/docs/reference/devkit/Workspace#plugins)
- [pluginsConfig](/docs/reference/devkit/Workspace#pluginsconfig)
- [projects](/docs/reference/devkit/Workspace#projects)
- [release](/docs/reference/devkit/Workspace#release)
- [sync](/docs/reference/devkit/Workspace#sync)
- [targetDefaults](/docs/reference/devkit/Workspace#targetdefaults)
- [tasksRunnerOptions](/docs/reference/devkit/Workspace#tasksrunneroptions)
- [tui](/docs/reference/devkit/Workspace#tui)
- [useDaemonProcess](/docs/reference/devkit/Workspace#usedaemonprocess)
- [useInferencePlugins](/docs/reference/devkit/Workspace#useinferenceplugins)
- [version](/docs/reference/devkit/Workspace#version)
- [workspaceLayout](/docs/reference/devkit/Workspace#workspacelayout)

## Properties

### $schema

• `Optional` **$schema**: `string`

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[$schema](/docs/reference/devkit/NxJsonConfiguration#$schema)

___

### affected

• `Optional` **affected**: [`NxAffectedConfig`](/docs/reference/devkit/NxAffectedConfig)

Default options for `nx affected`

**`Deprecated`**

use [defaultBase](/docs/reference/devkit/NxJsonConfiguration#defaultbase) instead. For more information see https://nx.dev/deprecated/affected-config#affected-config

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[affected](/docs/reference/devkit/NxJsonConfiguration#affected)

___

### analytics

• `Optional` **analytics**: `boolean`

Set this to true to allow Nx to collect usage analytics.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[analytics](/docs/reference/devkit/NxJsonConfiguration#analytics)

___

### cacheDirectory

• `Optional` **cacheDirectory**: `string`

Changes the directory used by Nx to store its cache.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[cacheDirectory](/docs/reference/devkit/NxJsonConfiguration#cachedirectory)

___

### cli

• `Optional` **cli**: `Object`

Default generator collection. It is used when no collection is provided.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `defaultProjectName?` | `string` |
| `packageManager?` | [`PackageManager`](/docs/reference/devkit/PackageManager) |

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[cli](/docs/reference/devkit/NxJsonConfiguration#cli)

___

### defaultBase

• `Optional` **defaultBase**: `string`

Default value for --base used by `nx affected` and `nx format`.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[defaultBase](/docs/reference/devkit/NxJsonConfiguration#defaultbase)

___

### defaultProject

• `Optional` **defaultProject**: `string`

Default project. When project isn't provided, the default project
will be used. Convenient for small workspaces with one main application.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[defaultProject](/docs/reference/devkit/NxJsonConfiguration#defaultproject)

___

### extends

• `Optional` **extends**: `string`

Optional (additional) Nx.json configuration file which becomes a base for this one

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[extends](/docs/reference/devkit/NxJsonConfiguration#extends)

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

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[generators](/docs/reference/devkit/NxJsonConfiguration#generators)

___

### implicitDependencies

• `Optional` **implicitDependencies**: [`ImplicitDependencyEntry`](/docs/reference/devkit/ImplicitDependencyEntry)\<`string`[] \| ``"*"``\>

Map of files to projects that implicitly depend on them

**`Deprecated`**

use [namedInputs](/docs/reference/devkit/NxJsonConfiguration#namedinputs) instead. For more information see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[implicitDependencies](/docs/reference/devkit/NxJsonConfiguration#implicitdependencies)

___

### installation

• `Optional` **installation**: `NxInstallationConfiguration`

Configures the Nx installation for a repo. Useful for maintaining  a separate
set of dependencies for Nx + Plugins compared to the base package.json, but also
useful for workspaces that don't have a root package.json + node_modules.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[installation](/docs/reference/devkit/NxJsonConfiguration#installation)

___

### maxCacheSize

• `Optional` **maxCacheSize**: `string`

Sets the maximum size of the local cache. Accepts a number followed by a unit (e.g. 100MB). Accepted units are B, KB, MB, and GB.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[maxCacheSize](/docs/reference/devkit/NxJsonConfiguration#maxcachesize)

___

### namedInputs

• `Optional` **namedInputs**: `Object`

Named inputs targets can refer to reduce duplication

#### Index signature

▪ [inputName: `string`]: (`string` \| `InputDefinition`)[]

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[namedInputs](/docs/reference/devkit/NxJsonConfiguration#namedinputs)

___

### neverConnectToCloud

• `Optional` **neverConnectToCloud**: `boolean`

Setting this to true will cause all attempts to setup your workspace to Nx Cloud to fail.
This value does not prevent using Nx Cloud if already connected.
Use NX_NO_CLOUD=true env var or the `--no-cloud` arg to prevent using Nx Cloud when running commands.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[neverConnectToCloud](/docs/reference/devkit/NxJsonConfiguration#neverconnecttocloud)

___

### nxCloudAccessToken

• `Optional` **nxCloudAccessToken**: `string`

If specified Nx will use nx-cloud by default with the given token.
To use a different runner that accepts an access token, define it in [tasksRunnerOptions](/docs/reference/devkit/NxJsonConfiguration#tasksrunneroptions)

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[nxCloudAccessToken](/docs/reference/devkit/NxJsonConfiguration#nxcloudaccesstoken)

___

### nxCloudEncryptionKey

• `Optional` **nxCloudEncryptionKey**: `string`

Specifies the encryption key used to encrypt artifacts data before sending it to nx cloud.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[nxCloudEncryptionKey](/docs/reference/devkit/NxJsonConfiguration#nxcloudencryptionkey)

___

### nxCloudId

• `Optional` **nxCloudId**: `string`

If specified Nx will use nx-cloud by default with the given cloud id.
To use a different runner that accepts a cloud id, define it in [tasksRunnerOptions](/docs/reference/devkit/NxJsonConfiguration#tasksrunneroptions)

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[nxCloudId](/docs/reference/devkit/NxJsonConfiguration#nxcloudid)

___

### nxCloudUrl

• `Optional` **nxCloudUrl**: `string`

Specifies the url pointing to an instance of nx cloud. Used for remote
caching and displaying run links.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[nxCloudUrl](/docs/reference/devkit/NxJsonConfiguration#nxcloudurl)

___

### parallel

• `Optional` **parallel**: `number`

Specifies how many tasks can be run in parallel.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[parallel](/docs/reference/devkit/NxJsonConfiguration#parallel)

___

### plugins

• `Optional` **plugins**: [`PluginConfiguration`](/docs/reference/devkit/PluginConfiguration)[]

Plugins for extending the project graph

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[plugins](/docs/reference/devkit/NxJsonConfiguration#plugins)

___

### pluginsConfig

• `Optional` **pluginsConfig**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Configuration for Nx Plugins

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[pluginsConfig](/docs/reference/devkit/NxJsonConfiguration#pluginsconfig)

___

### projects

• **projects**: `Record`\<`string`, [`ProjectConfiguration`](/docs/reference/devkit/ProjectConfiguration)\>

Projects' projects

#### Overrides

[ProjectsConfigurations](/docs/reference/devkit/ProjectsConfigurations).[projects](/docs/reference/devkit/ProjectsConfigurations#projects)

___

### release

• `Optional` **release**: `NxReleaseConfiguration`

Configuration for `nx release` (versioning and publishing of applications and libraries)

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[release](/docs/reference/devkit/NxJsonConfiguration#release)

___

### sync

• `Optional` **sync**: `NxSyncConfiguration`

Configuration for the `nx sync` command.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[sync](/docs/reference/devkit/NxJsonConfiguration#sync)

___

### targetDefaults

• `Optional` **targetDefaults**: [`TargetDefaults`](/docs/reference/devkit/TargetDefaults)

Dependencies between different target names across all projects

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[targetDefaults](/docs/reference/devkit/NxJsonConfiguration#targetdefaults)

___

### tasksRunnerOptions

• `Optional` **tasksRunnerOptions**: `Object`

**`Deprecated`**

Custom task runners will be replaced by a new API starting with Nx 21. More info: https://nx.dev/deprecated/custom-tasks-runner
Available Task Runners for Nx to use

#### Index signature

▪ [tasksRunnerName: `string`]: \{ `options?`: `any` ; `runner?`: `string`  }

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[tasksRunnerOptions](/docs/reference/devkit/NxJsonConfiguration#tasksrunneroptions)

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

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[tui](/docs/reference/devkit/NxJsonConfiguration#tui)

___

### useDaemonProcess

• `Optional` **useDaemonProcess**: `boolean`

Set this to false to disable the daemon.

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[useDaemonProcess](/docs/reference/devkit/NxJsonConfiguration#usedaemonprocess)

___

### useInferencePlugins

• `Optional` **useInferencePlugins**: `boolean`

Set this to false to disable adding inference plugins when generating new projects

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[useInferencePlugins](/docs/reference/devkit/NxJsonConfiguration#useinferenceplugins)

___

### version

• **version**: `number`

Version of the configuration format

#### Inherited from

[ProjectsConfigurations](/docs/reference/devkit/ProjectsConfigurations).[version](/docs/reference/devkit/ProjectsConfigurations#version)

___

### workspaceLayout

• `Optional` **workspaceLayout**: `Object`

Where new apps + libs should be placed

#### Type declaration

| Name | Type |
| :------ | :------ |
| `appsDir?` | `string` |
| `libsDir?` | `string` |

#### Inherited from

[NxJsonConfiguration](/docs/reference/devkit/NxJsonConfiguration).[workspaceLayout](/docs/reference/devkit/NxJsonConfiguration#workspacelayout)
