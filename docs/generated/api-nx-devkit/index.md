# Module: index

The Nx Devkit is the underlying technology used to customize Nx to support
different technologies and custom use-cases. It contains many utility
functions for reading and writing files, updating configuration,
working with Abstract Syntax Trees(ASTs), and more.

As with most things in Nx, the core of Nx Devkit is very simple.
It only uses language primitives and immutable objects
(the tree being the only exception).

## Table of contents

### Project Graph Enumerations

- [DependencyType](../../nx-devkit/index#dependencytype)

### Utils Enumerations

- [ChangeType](../../nx-devkit/index#changetype)

### Project Graph Classes

- [ProjectGraphBuilder](../../nx-devkit/index#projectgraphbuilder)

### Utils Classes

- [Hasher](../../nx-devkit/index#hasher)

### Workspace Classes

- [Workspaces](../../nx-devkit/index#workspaces)

### Commands Interfaces

- [Target](../../nx-devkit/index#target)

### Other Interfaces

- [NxPlugin](../../nx-devkit/index#nxplugin)

### Project Graph Interfaces

- [FileData](../../nx-devkit/index#filedata)
- [ProjectFileMap](../../nx-devkit/index#projectfilemap)
- [ProjectGraph](../../nx-devkit/index#projectgraph)
- [ProjectGraphDependency](../../nx-devkit/index#projectgraphdependency)
- [ProjectGraphExternalNode](../../nx-devkit/index#projectgraphexternalnode)
- [ProjectGraphProcessorContext](../../nx-devkit/index#projectgraphprocessorcontext)
- [ProjectGraphProjectNode](../../nx-devkit/index#projectgraphprojectnode)
- [ProjectGraphV4](../../nx-devkit/index#projectgraphv4)

### Tree Interfaces

- [FileChange](../../nx-devkit/index#filechange)
- [Tree](../../nx-devkit/index#tree)

### Utils Interfaces

- [DefaultTasksRunnerOptions](../../nx-devkit/index#defaulttasksrunneroptions)
- [Hash](../../nx-devkit/index#hash)
- [JsonParseOptions](../../nx-devkit/index#jsonparseoptions)
- [JsonSerializeOptions](../../nx-devkit/index#jsonserializeoptions)
- [RemoteCache](../../nx-devkit/index#remotecache)
- [StringDeletion](../../nx-devkit/index#stringdeletion)
- [StringInsertion](../../nx-devkit/index#stringinsertion)

### Workspace Interfaces

- [ExecutorContext](../../nx-devkit/index#executorcontext)
- [ImplicitJsonSubsetDependency](../../nx-devkit/index#implicitjsonsubsetdependency)
- [NxAffectedConfig](../../nx-devkit/index#nxaffectedconfig)
- [NxJsonConfiguration](../../nx-devkit/index#nxjsonconfiguration)
- [NxJsonProjectConfiguration](../../nx-devkit/index#nxjsonprojectconfiguration)
- [ProjectConfiguration](../../nx-devkit/index#projectconfiguration)
- [TargetConfiguration](../../nx-devkit/index#targetconfiguration)
- [TargetDependencyConfig](../../nx-devkit/index#targetdependencyconfig)
- [Task](../../nx-devkit/index#task)
- [TaskGraph](../../nx-devkit/index#taskgraph)
- [Workspace](../../nx-devkit/index#workspace)
- [WorkspaceJsonConfiguration](../../nx-devkit/index#workspacejsonconfiguration)

### Generators Type aliases

- [WorkspaceConfiguration](../../nx-devkit/index#workspaceconfiguration)

### Other Type aliases

- [ProjectTargetConfigurator](../../nx-devkit/index#projecttargetconfigurator)

### Package Manager Type aliases

- [PackageManager](../../nx-devkit/index#packagemanager)

### Project Graph Type aliases

- [ProjectGraphNode](../../nx-devkit/index#projectgraphnode)

### Utils Type aliases

- [StringChange](../../nx-devkit/index#stringchange)

### Workspace Type aliases

- [Executor](../../nx-devkit/index#executor)
- [Generator](../../nx-devkit/index#generator)
- [GeneratorCallback](../../nx-devkit/index#generatorcallback)
- [ImplicitDependencyEntry](../../nx-devkit/index#implicitdependencyentry)
- [ProjectType](../../nx-devkit/index#projecttype)
- [TaskGraphExecutor](../../nx-devkit/index#taskgraphexecutor)

### Logger Variables

- [logger](../../nx-devkit/index#logger)

### Utils Variables

- [appRootPath](../../nx-devkit/index#approotpath)
- [cacheDir](../../nx-devkit/index#cachedir)
- [output](../../nx-devkit/index#output)
- [workspaceRoot](../../nx-devkit/index#workspaceroot)

### Functions

- [addDependenciesToPackageJson](../../nx-devkit/index#adddependenciestopackagejson)
- [addProjectConfiguration](../../nx-devkit/index#addprojectconfiguration)
- [applyChangesToString](../../nx-devkit/index#applychangestostring)
- [convertNxExecutor](../../nx-devkit/index#convertnxexecutor)
- [convertNxGenerator](../../nx-devkit/index#convertnxgenerator)
- [createProjectGraphAsync](../../nx-devkit/index#createprojectgraphasync)
- [defaultTasksRunner](../../nx-devkit/index#defaulttasksrunner)
- [detectPackageManager](../../nx-devkit/index#detectpackagemanager)
- [formatFiles](../../nx-devkit/index#formatfiles)
- [generateFiles](../../nx-devkit/index#generatefiles)
- [getOutputsForTargetAndConfiguration](../../nx-devkit/index#getoutputsfortargetandconfiguration)
- [getPackageManagerCommand](../../nx-devkit/index#getpackagemanagercommand)
- [getPackageManagerVersion](../../nx-devkit/index#getpackagemanagerversion)
- [getProjects](../../nx-devkit/index#getprojects)
- [getWorkspaceLayout](../../nx-devkit/index#getworkspacelayout)
- [getWorkspacePath](../../nx-devkit/index#getworkspacepath)
- [installPackagesTask](../../nx-devkit/index#installpackagestask)
- [isStandaloneProject](../../nx-devkit/index#isstandaloneproject)
- [joinPathFragments](../../nx-devkit/index#joinpathfragments)
- [moveFilesToNewDirectory](../../nx-devkit/index#movefilestonewdirectory)
- [names](../../nx-devkit/index#names)
- [normalizePath](../../nx-devkit/index#normalizepath)
- [offsetFromRoot](../../nx-devkit/index#offsetfromroot)
- [parseJson](../../nx-devkit/index#parsejson)
- [parseTargetString](../../nx-devkit/index#parsetargetstring)
- [readCachedProjectGraph](../../nx-devkit/index#readcachedprojectgraph)
- [readJson](../../nx-devkit/index#readjson)
- [readJsonFile](../../nx-devkit/index#readjsonfile)
- [readNxJson](../../nx-devkit/index#readnxjson)
- [readProjectConfiguration](../../nx-devkit/index#readprojectconfiguration)
- [readTargetOptions](../../nx-devkit/index#readtargetoptions)
- [readWorkspaceConfiguration](../../nx-devkit/index#readworkspaceconfiguration)
- [removeDependenciesFromPackageJson](../../nx-devkit/index#removedependenciesfrompackagejson)
- [removeProjectConfiguration](../../nx-devkit/index#removeprojectconfiguration)
- [reverse](../../nx-devkit/index#reverse)
- [runExecutor](../../nx-devkit/index#runexecutor)
- [serializeJson](../../nx-devkit/index#serializejson)
- [stripIndents](../../nx-devkit/index#stripindents)
- [stripJsonComments](../../nx-devkit/index#stripjsoncomments)
- [targetToTargetString](../../nx-devkit/index#targettotargetstring)
- [toJS](../../nx-devkit/index#tojs)
- [updateJson](../../nx-devkit/index#updatejson)
- [updateProjectConfiguration](../../nx-devkit/index#updateprojectconfiguration)
- [updateTsConfigsToJs](../../nx-devkit/index#updatetsconfigstojs)
- [updateWorkspaceConfiguration](../../nx-devkit/index#updateworkspaceconfiguration)
- [visitNotIgnoredFiles](../../nx-devkit/index#visitnotignoredfiles)
- [workspaceLayout](../../nx-devkit/index#workspacelayout)
- [writeJson](../../nx-devkit/index#writejson)
- [writeJsonFile](../../nx-devkit/index#writejsonfile)

## Project Graph Enumerations

### DependencyType

• **DependencyType**: `Object`

---

## Utils Enumerations

### ChangeType

• **ChangeType**: `Object`

## Project Graph Classes

### ProjectGraphBuilder

• **ProjectGraphBuilder**: `Object`

---

## Utils Classes

### Hasher

• **Hasher**: `Object`

---

## Workspace Classes

### Workspaces

• **Workspaces**: `Object`

## Commands Interfaces

### Target

• **Target**: `Object`

---

## Other Interfaces

### NxPlugin

• **NxPlugin**: `Object`

A plugin for Nx

---

## Project Graph Interfaces

### FileData

• **FileData**: `Object`

---

### ProjectFileMap

• **ProjectFileMap**: `Object`

---

### ProjectGraph

• **ProjectGraph**<`T`\>: `Object`

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

---

### ProjectGraphDependency

• **ProjectGraphDependency**: `Object`

---

### ProjectGraphExternalNode

• **ProjectGraphExternalNode**: `Object`

---

### ProjectGraphProcessorContext

• **ProjectGraphProcessorContext**: `Object`

---

### ProjectGraphProjectNode

• **ProjectGraphProjectNode**<`T`\>: `Object`

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

---

### ProjectGraphV4

• **ProjectGraphV4**<`T`\>: `Object`

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

---

## Tree Interfaces

### FileChange

• **FileChange**: `Object`

---

### Tree

• **Tree**: `Object`

---

## Utils Interfaces

### DefaultTasksRunnerOptions

• **DefaultTasksRunnerOptions**: `Object`

---

### Hash

• **Hash**: `Object`

---

### JsonParseOptions

• **JsonParseOptions**: `Object`

---

### JsonSerializeOptions

• **JsonSerializeOptions**: `Object`

---

### RemoteCache

• **RemoteCache**: `Object`

---

### StringDeletion

• **StringDeletion**: `Object`

---

### StringInsertion

• **StringInsertion**: `Object`

---

## Workspace Interfaces

### ExecutorContext

• **ExecutorContext**: `Object`

---

### ImplicitJsonSubsetDependency

• **ImplicitJsonSubsetDependency**<`T`\>: `Object`

#### Type parameters

| Name | Type                |
| :--- | :------------------ |
| `T`  | `"*"` \| `string`[] |

---

### NxAffectedConfig

• **NxAffectedConfig**: `Object`

---

### NxJsonConfiguration

• **NxJsonConfiguration**<`T`\>: `Object`

#### Type parameters

| Name | Type                |
| :--- | :------------------ |
| `T`  | `"*"` \| `string`[] |

---

### NxJsonProjectConfiguration

• **NxJsonProjectConfiguration**: `Object`

---

### ProjectConfiguration

• **ProjectConfiguration**: `Object`

---

### TargetConfiguration

• **TargetConfiguration**: `Object`

---

### TargetDependencyConfig

• **TargetDependencyConfig**: `Object`

---

### Task

• **Task**: `Object`

---

### TaskGraph

• **TaskGraph**: `Object`

---

### Workspace

• **Workspace**: `Object`

---

### WorkspaceJsonConfiguration

• **WorkspaceJsonConfiguration**: `Object`

## Generators Type aliases

### WorkspaceConfiguration

Ƭ **WorkspaceConfiguration**: `Omit`<[`WorkspaceJsonConfiguration`](../../nx-devkit/index#workspacejsonconfiguration), `"projects"`\> & `Partial`<[`NxJsonConfiguration`](../../nx-devkit/index#nxjsonconfiguration)\>

---

## Other Type aliases

### ProjectTargetConfigurator

Ƭ **ProjectTargetConfigurator**: (`file`: `string`) => `Record`<`string`, [`TargetConfiguration`](../../nx-devkit/index#targetconfiguration)\>

#### Type declaration

▸ (`file`): `Record`<`string`, [`TargetConfiguration`](../../nx-devkit/index#targetconfiguration)\>

##### Parameters

| Name   | Type     |
| :----- | :------- |
| `file` | `string` |

##### Returns

`Record`<`string`, [`TargetConfiguration`](../../nx-devkit/index#targetconfiguration)\>

---

## Package Manager Type aliases

### PackageManager

Ƭ **PackageManager**: `"yarn"` \| `"pnpm"` \| `"npm"`

---

## Project Graph Type aliases

### ProjectGraphNode

Ƭ **ProjectGraphNode**<`T`\>: [`ProjectGraphProjectNode`](../../nx-devkit/index#projectgraphprojectnode)<`T`\> \| [`ProjectGraphExternalNode`](../../nx-devkit/index#projectgraphexternalnode)

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

---

## Utils Type aliases

### StringChange

Ƭ **StringChange**: [`StringInsertion`](../../nx-devkit/index#stringinsertion) \| [`StringDeletion`](../../nx-devkit/index#stringdeletion)

---

## Workspace Type aliases

### Executor

Ƭ **Executor**<`T`\>: (`options`: `T`, `context`: [`ExecutorContext`](../../nx-devkit/index#executorcontext)) => `Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`options`, `context`): `Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

Implementation of a target of a project

##### Parameters

| Name      | Type                                                       |
| :-------- | :--------------------------------------------------------- |
| `options` | `T`                                                        |
| `context` | [`ExecutorContext`](../../nx-devkit/index#executorcontext) |

##### Returns

`Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

---

### Generator

Ƭ **Generator**<`T`\>: (`tree`: `any`, `schema`: `T`) => `void` \| [`GeneratorCallback`](../../nx-devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../nx-devkit/index#generatorcallback)\>

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`tree`, `schema`): `void` \| [`GeneratorCallback`](../../nx-devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../nx-devkit/index#generatorcallback)\>

A function that schedules updates to the filesystem to be done atomically

##### Parameters

| Name     | Type  |
| :------- | :---- |
| `tree`   | `any` |
| `schema` | `T`   |

##### Returns

`void` \| [`GeneratorCallback`](../../nx-devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../nx-devkit/index#generatorcallback)\>

---

### GeneratorCallback

Ƭ **GeneratorCallback**: () => `void` \| `Promise`<`void`\>

#### Type declaration

▸ (): `void` \| `Promise`<`void`\>

A callback function that is executed after changes are made to the file system

##### Returns

`void` \| `Promise`<`void`\>

---

### ImplicitDependencyEntry

Ƭ **ImplicitDependencyEntry**<`T`\>: `Object`

#### Type parameters

| Name | Type                |
| :--- | :------------------ |
| `T`  | `"*"` \| `string`[] |

#### Index signature

▪ [key: `string`]: `T` \| [`ImplicitJsonSubsetDependency`](../../nx-devkit/index#implicitjsonsubsetdependency)<`T`\>

---

### ProjectType

Ƭ **ProjectType**: `"library"` \| `"application"`

---

### TaskGraphExecutor

Ƭ **TaskGraphExecutor**<`T`\>: (`taskGraph`: [`TaskGraph`](../../nx-devkit/index#taskgraph), `options`: `Record`<`string`, `T`\>, `overrides`: `T`, `context`: [`ExecutorContext`](../../nx-devkit/index#executorcontext)) => `Promise`<`Record`<`string`, `Object`\>\>

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`taskGraph`, `options`, `overrides`, `context`): `Promise`<`Record`<`string`, `Object`\>\>

Implementation of a target of a project that handles multiple projects to be batched

##### Parameters

| Name        | Type                                                       |
| :---------- | :--------------------------------------------------------- |
| `taskGraph` | [`TaskGraph`](../../nx-devkit/index#taskgraph)             |
| `options`   | `Record`<`string`, `T`\>                                   |
| `overrides` | `T`                                                        |
| `context`   | [`ExecutorContext`](../../nx-devkit/index#executorcontext) |

##### Returns

`Promise`<`Record`<`string`, `Object`\>\>

## Logger Variables

### logger

• **logger**: `Object`

#### Type declaration

| Name    | Type                        |
| :------ | :-------------------------- |
| `debug` | (...`s`: `any`[]) => `void` |
| `error` | (`s`: `any`) => `void`      |
| `fatal` | (...`s`: `any`[]) => `void` |
| `info`  | (`s`: `any`) => `void`      |
| `log`   | (...`s`: `any`[]) => `void` |
| `warn`  | (`s`: `any`) => `void`      |

---

## Utils Variables

### appRootPath

• **appRootPath**: `string`

---

### cacheDir

• **cacheDir**: `string`

---

### output

• **output**: `CLIOutput`

---

### workspaceRoot

• **workspaceRoot**: `string` = `appRootPath`

## Functions

### addDependenciesToPackageJson

▸ **addDependenciesToPackageJson**(`tree`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](../../nx-devkit/index#generatorcallback)

Add Dependencies and Dev Dependencies to package.json

For example:

```typescript
addDependenciesToPackageJson(tree, { react: 'latest' }, { jest: 'latest' });
```

This will **add** `react` and `jest` to the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name              | Type                                 | Default value    | Description                                                             |
| :---------------- | :----------------------------------- | :--------------- | :---------------------------------------------------------------------- |
| `tree`            | [`Tree`](../../nx-devkit/index#tree) | `undefined`      | Tree representing file system to modify                                 |
| `dependencies`    | `Record`<`string`, `string`\>        | `undefined`      | Dependencies to be added to the dependencies section of package.json    |
| `devDependencies` | `Record`<`string`, `string`\>        | `undefined`      | Dependencies to be added to the devDependencies section of package.json |
| `packageJsonPath` | `string`                             | `'package.json'` | Path to package.json                                                    |

#### Returns

[`GeneratorCallback`](../../nx-devkit/index#generatorcallback)

Callback to install dependencies only if necessary. undefined is returned if changes are not necessary.

---

### addProjectConfiguration

▸ **addProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`, `standalone?`): `void`

Adds project configuration to the Nx workspace.

The project configuration is stored in workspace.json or the associated project.json file.
The utility will update either files.

#### Parameters

| Name                   | Type                                                                 | Description                                                                                |
| :--------------------- | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `tree`                 | [`Tree`](../../nx-devkit/index#tree)                                 | the file system tree                                                                       |
| `projectName`          | `string`                                                             | unique name. Often directories are part of the name (e.g., mydir-mylib)                    |
| `projectConfiguration` | [`ProjectConfiguration`](../../nx-devkit/index#projectconfiguration) | project configuration                                                                      |
| `standalone?`          | `boolean`                                                            | should the project use package.json? If false, the project config is inside workspace.json |

#### Returns

`void`

---

### applyChangesToString

▸ **applyChangesToString**(`text`, `changes`): `string`

Applies a list of changes to a string's original value.

This is useful when working with ASTs.

For Example, to rename a property in a method's options:

```typescript
const code = `bootstrap({
  target: document.querySelector('#app')
})`;

const indexOfPropertyName = 13; // Usually determined by analyzing an AST.
const updatedCode = applyChangesToString(code, [
  {
    type: ChangeType.Insert,
    index: indexOfPropertyName,
    text: 'element',
  },
  {
    type: ChangeType.Delete,
    start: indexOfPropertyName,
    length: 6,
  },
]);

bootstrap({
  element: document.querySelector('#app'),
});
```

#### Parameters

| Name      | Type                                                   |
| :-------- | :----------------------------------------------------- |
| `text`    | `string`                                               |
| `changes` | [`StringChange`](../../nx-devkit/index#stringchange)[] |

#### Returns

`string`

---

### convertNxExecutor

▸ **convertNxExecutor**(`executor`): `any`

Convert an Nx Executor into an Angular Devkit Builder

Use this to expose a compatible Angular Builder

#### Parameters

| Name       | Type                                                 |
| :--------- | :--------------------------------------------------- |
| `executor` | [`Executor`](../../nx-devkit/index#executor)<`any`\> |

#### Returns

`any`

---

### convertNxGenerator

▸ **convertNxGenerator**<`T`\>(`generator`): (`options`: `T`) => (`tree`: `any`, `context`: `any`) => `Promise`<`any`\>

Convert an Nx Generator into an Angular Devkit Schematic

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Parameters

| Name        | Type                                                 |
| :---------- | :--------------------------------------------------- |
| `generator` | [`Generator`](../../nx-devkit/index#generator)<`T`\> |

#### Returns

`fn`

▸ (`options`): (`tree`: `any`, `context`: `any`) => `Promise`<`any`\>

##### Parameters

| Name      | Type |
| :-------- | :--- |
| `options` | `T`  |

##### Returns

`fn`

▸ (`tree`, `context`): `Promise`<`any`\>

##### Parameters

| Name      | Type  |
| :-------- | :---- |
| `tree`    | `any` |
| `context` | `any` |

##### Returns

`Promise`<`any`\>

---

### createProjectGraphAsync

▸ **createProjectGraphAsync**(): `Promise`<[`ProjectGraph`](../../nx-devkit/index#projectgraph)\>

Computes and returns a ProjectGraph.

Nx will compute the graph either in a daemon process or in the current process.

Nx will compute it in the current process if:

- The process is running in CI (CI env variable is to true or other common variables used by CI providers are set).
- It is running in the docker container.
- The daemon process is disabled because of the previous error when starting the daemon.
- `NX_DAEMON` is set to `false`.
- `useDaemon` is set to false in `nx.json`

`NX_DAEMON` env variable takes precedence:

- If it is set to true, the daemon will always be used.
- If it is set to false, the graph will always be computed in the current process.

Tip: If you want to debug project graph creation, run your command with NX_DAEMON=false.

Nx uses two layers of caching: the information about explicit dependencies stored on the disk and the information
stored in the daemon process. To reset both run: `nx reset`.

#### Returns

`Promise`<[`ProjectGraph`](../../nx-devkit/index#projectgraph)\>

---

### defaultTasksRunner

▸ `Const` **defaultTasksRunner**(`tasks`, `options`, `context?`): `Observable`<`AffectedEvent`\> \| `Promise`<`Object`\>

#### Parameters

| Name                         | Type                                                                                     |
| :--------------------------- | :--------------------------------------------------------------------------------------- |
| `tasks`                      | [`Task`](../../nx-devkit/index#task)[]                                                   |
| `options`                    | [`DefaultTasksRunnerOptions`](../../nx-devkit/index#defaulttasksrunneroptions)           |
| `context?`                   | `Object`                                                                                 |
| `context.initiatingProject?` | `string`                                                                                 |
| `context.nxJson`             | [`NxJsonConfiguration`](../../nx-devkit/index#nxjsonconfiguration)<`string`[] \| `"*"`\> |
| `context.projectGraph`       | [`ProjectGraph`](../../nx-devkit/index#projectgraph)<`any`\>                             |
| `context.target?`            | `string`                                                                                 |

#### Returns

`Observable`<`AffectedEvent`\> \| `Promise`<`Object`\>

---

### detectPackageManager

▸ **detectPackageManager**(`dir?`): [`PackageManager`](../../nx-devkit/index#packagemanager)

Detects which package manager is used in the workspace based on the lock file.

#### Parameters

| Name  | Type     | Default value |
| :---- | :------- | :------------ |
| `dir` | `string` | `''`          |

#### Returns

[`PackageManager`](../../nx-devkit/index#packagemanager)

---

### formatFiles

▸ **formatFiles**(`tree`): `Promise`<`void`\>

Formats all the created or updated files using Prettier

#### Parameters

| Name   | Type                                 | Description          |
| :----- | :----------------------------------- | :------------------- |
| `tree` | [`Tree`](../../nx-devkit/index#tree) | the file system tree |

#### Returns

`Promise`<`void`\>

---

### generateFiles

▸ **generateFiles**(`tree`, `srcFolder`, `target`, `substitutions`): `void`

Generates a folder of files based on provided templates.

While doing so it performs two substitutions:

- Substitutes segments of file names surrounded by \_\_
- Uses ejs to substitute values in templates

Examples:

```typescript
generateFiles(tree, path.join(__dirname, 'files'), './tools/scripts', {
  tmpl: '',
  name: 'myscript',
});
```

This command will take all the files from the `files` directory next to the place where the command is invoked from.
It will replace all `__tmpl__` with '' and all `__name__` with 'myscript' in the file names, and will replace all
`<%= name %>` with `myscript` in the files themselves.
`tmpl: ''` is a common pattern. With it you can name files like this: `index.ts__tmpl__`, so your editor
doesn't get confused about incorrect TypeScript files.

#### Parameters

| Name            | Type                                 | Description                                   |
| :-------------- | :----------------------------------- | :-------------------------------------------- |
| `tree`          | [`Tree`](../../nx-devkit/index#tree) | the file system tree                          |
| `srcFolder`     | `string`                             | the source folder of files (absolute path)    |
| `target`        | `string`                             | the target folder (relative to the tree root) |
| `substitutions` | `Object`                             | an object of key-value pairs                  |

#### Returns

`void`

---

### getOutputsForTargetAndConfiguration

▸ **getOutputsForTargetAndConfiguration**(`task`, `node`): `any`

Returns the list of outputs that will be cached.

#### Parameters

| Name   | Type                                                                               | Description                                               |
| :----- | :--------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| `task` | `Pick`<[`Task`](../../nx-devkit/index#task), `"target"` \| `"overrides"`\>         | target + overrides                                        |
| `node` | [`ProjectGraphProjectNode`](../../nx-devkit/index#projectgraphprojectnode)<`any`\> | ProjectGraphProjectNode object that the task runs against |

#### Returns

`any`

---

### getPackageManagerCommand

▸ **getPackageManagerCommand**(`packageManager?`): `PackageManagerCommands`

Returns commands for the package manager used in the workspace.
By default, the package manager is derived based on the lock file,
but it can also be passed in explicitly.

Example:

```javascript
execSync(`${getPackageManagerCommand().addDev} my-dev-package`);
```

#### Parameters

| Name             | Type                                                     |
| :--------------- | :------------------------------------------------------- |
| `packageManager` | [`PackageManager`](../../nx-devkit/index#packagemanager) |

#### Returns

`PackageManagerCommands`

---

### getPackageManagerVersion

▸ **getPackageManagerVersion**(`packageManager?`): `string`

Returns the version of the package manager used in the workspace.
By default, the package manager is derived based on the lock file,
but it can also be passed in explicitly.

#### Parameters

| Name             | Type                                                     |
| :--------------- | :------------------------------------------------------- |
| `packageManager` | [`PackageManager`](../../nx-devkit/index#packagemanager) |

#### Returns

`string`

---

### getProjects

▸ **getProjects**(`tree`): `Map`<`string`, [`ProjectConfiguration`](../../nx-devkit/index#projectconfiguration)\>

Get a map of all projects in a workspace.

Use [readProjectConfiguration](../../nx-devkit/index#readprojectconfiguration) if only one project is needed.

#### Parameters

| Name   | Type                                 |
| :----- | :----------------------------------- |
| `tree` | [`Tree`](../../nx-devkit/index#tree) |

#### Returns

`Map`<`string`, [`ProjectConfiguration`](../../nx-devkit/index#projectconfiguration)\>

---

### getWorkspaceLayout

▸ **getWorkspaceLayout**(`tree`): `Object`

Returns workspace defaults. It includes defaults folders for apps and libs,
and the default scope.

Example:

```typescript
{ appsDir: 'apps', libsDir: 'libs', npmScope: 'myorg' }
```

#### Parameters

| Name   | Type                                 | Description      |
| :----- | :----------------------------------- | :--------------- |
| `tree` | [`Tree`](../../nx-devkit/index#tree) | file system tree |

#### Returns

`Object`

| Name                  | Type      |
| :-------------------- | :-------- |
| `appsDir`             | `string`  |
| `libsDir`             | `string`  |
| `npmScope`            | `string`  |
| `standaloneAsDefault` | `boolean` |

---

### getWorkspacePath

▸ **getWorkspacePath**(`tree`): `"/angular.json"` \| `"/workspace.json"` \| `null`

#### Parameters

| Name   | Type                                 |
| :----- | :----------------------------------- |
| `tree` | [`Tree`](../../nx-devkit/index#tree) |

#### Returns

`"/angular.json"` \| `"/workspace.json"` \| `null`

---

### installPackagesTask

▸ **installPackagesTask**(`tree`, `alwaysRun?`, `cwd?`, `packageManager?`): `void`

Runs `npm install` or `yarn install`. It will skip running the install if
`package.json` hasn't changed at all or it hasn't changed since the last invocation.

#### Parameters

| Name             | Type                                                     | Default value | Description                                                   |
| :--------------- | :------------------------------------------------------- | :------------ | :------------------------------------------------------------ |
| `tree`           | [`Tree`](../../nx-devkit/index#tree)                     | `undefined`   | the file system tree                                          |
| `alwaysRun`      | `boolean`                                                | `false`       | always run the command even if `package.json` hasn't changed. |
| `cwd`            | `string`                                                 | `''`          | -                                                             |
| `packageManager` | [`PackageManager`](../../nx-devkit/index#packagemanager) | `undefined`   | -                                                             |

#### Returns

`void`

---

### isStandaloneProject

▸ **isStandaloneProject**(`tree`, `project`): `boolean`

Returns if a project has a standalone configuration (project.json).

#### Parameters

| Name      | Type                                 | Description          |
| :-------- | :----------------------------------- | :------------------- |
| `tree`    | [`Tree`](../../nx-devkit/index#tree) | the file system tree |
| `project` | `string`                             | the project name     |

#### Returns

`boolean`

---

### joinPathFragments

▸ **joinPathFragments**(...`fragments`): `string`

Normalized path fragments and joins them

#### Parameters

| Name           | Type       |
| :------------- | :--------- |
| `...fragments` | `string`[] |

#### Returns

`string`

---

### moveFilesToNewDirectory

▸ **moveFilesToNewDirectory**(`tree`, `oldDir`, `newDir`): `void`

Analogous to cp -r oldDir newDir

#### Parameters

| Name     | Type                                 |
| :------- | :----------------------------------- |
| `tree`   | [`Tree`](../../nx-devkit/index#tree) |
| `oldDir` | `string`                             |
| `newDir` | `string`                             |

#### Returns

`void`

---

### names

▸ **names**(`name`): `Object`

Util function to generate different strings based off the provided name.

Examples:

```typescript
names('my-name'); // {name: 'my-name', className: 'MyName', propertyName: 'myName', constantName: 'MY_NAME', fileName: 'my-name'}
names('myName'); // {name: 'my-name', className: 'MyName', propertyName: 'myName', constantName: 'MY_NAME', fileName: 'my-name'}
```

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `name` | `string` |

#### Returns

`Object`

| Name           | Type     |
| :------------- | :------- |
| `className`    | `string` |
| `constantName` | `string` |
| `fileName`     | `string` |
| `name`         | `string` |
| `propertyName` | `string` |

---

### normalizePath

▸ **normalizePath**(`osSpecificPath`): `string`

Coverts an os specific path to a unix style path

#### Parameters

| Name             | Type     |
| :--------------- | :------- |
| `osSpecificPath` | `string` |

#### Returns

`string`

---

### offsetFromRoot

▸ **offsetFromRoot**(`fullPathToDir`): `string`

Calculates an offset from the root of the workspace, which is useful for
constructing relative URLs.

Examples:

```typescript
offsetFromRoot('apps/mydir/myapp/'); // returns "../../../"
```

#### Parameters

| Name            | Type     | Description    |
| :-------------- | :------- | :------------- |
| `fullPathToDir` | `string` | directory path |

#### Returns

`string`

---

### parseJson

▸ **parseJson**<`T`\>(`input`, `options?`): `T`

Parses the given JSON string and returns the object the JSON content represents.
By default javascript-style comments are allowed.

#### Type parameters

| Name | Type                     |
| :--- | :----------------------- |
| `T`  | extends `object` = `any` |

#### Parameters

| Name       | Type                                                         | Description            |
| :--------- | :----------------------------------------------------------- | :--------------------- |
| `input`    | `string`                                                     | JSON content as string |
| `options?` | [`JsonParseOptions`](../../nx-devkit/index#jsonparseoptions) | JSON parse options     |

#### Returns

`T`

Object the JSON content represents

---

### parseTargetString

▸ **parseTargetString**(`targetString`): [`Target`](../../nx-devkit/index#target)

Parses a target string into {project, target, configuration}

Examples:

```typescript
parseTargetString('proj:test'); // returns { project: "proj", target: "test" }
parseTargetString('proj:test:production'); // returns { project: "proj", target: "test", configuration: "production" }
```

#### Parameters

| Name           | Type     | Description      |
| :------------- | :------- | :--------------- |
| `targetString` | `string` | target reference |

#### Returns

[`Target`](../../nx-devkit/index#target)

---

### readCachedProjectGraph

▸ **readCachedProjectGraph**(): [`ProjectGraph`](../../nx-devkit/index#projectgraph)

Synchronously reads the latest cached copy of the workspace's ProjectGraph.

**`throws`** {Error} if there is no cached ProjectGraph to read from

#### Returns

[`ProjectGraph`](../../nx-devkit/index#projectgraph)

---

### readJson

▸ **readJson**<`T`\>(`tree`, `path`, `options?`): `T`

Reads a json file, removes all comments and parses JSON.

#### Type parameters

| Name | Type                     |
| :--- | :----------------------- |
| `T`  | extends `object` = `any` |

#### Parameters

| Name       | Type                                                         | Description                 |
| :--------- | :----------------------------------------------------------- | :-------------------------- |
| `tree`     | [`Tree`](../../nx-devkit/index#tree)                         | file system tree            |
| `path`     | `string`                                                     | file path                   |
| `options?` | [`JsonParseOptions`](../../nx-devkit/index#jsonparseoptions) | Optional JSON Parse Options |

#### Returns

`T`

---

### readJsonFile

▸ **readJsonFile**<`T`\>(`path`, `options?`): `T`

Reads a JSON file and returns the object the JSON content represents.

#### Type parameters

| Name | Type                     |
| :--- | :----------------------- |
| `T`  | extends `object` = `any` |

#### Parameters

| Name       | Type              | Description        |
| :--------- | :---------------- | :----------------- |
| `path`     | `string`          | A path to a file.  |
| `options?` | `JsonReadOptions` | JSON parse options |

#### Returns

`T`

Object the JSON content of the file represents

---

### readNxJson

▸ **readNxJson**(`path?`): [`NxJsonConfiguration`](../../nx-devkit/index#nxjsonconfiguration)

Returns the contents of nx.json.

If nx.json extends another config file, it will be inlined here.

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `path` | `string` |

#### Returns

[`NxJsonConfiguration`](../../nx-devkit/index#nxjsonconfiguration)

---

### readProjectConfiguration

▸ **readProjectConfiguration**(`tree`, `projectName`): [`ProjectConfiguration`](../../nx-devkit/index#projectconfiguration)

Reads a project configuration.

The project configuration is stored in workspace.json or the associated project.json file.
The utility will read from either file.

**`throws`** If supplied projectName cannot be found

#### Parameters

| Name          | Type                                 | Description                                                             |
| :------------ | :----------------------------------- | :---------------------------------------------------------------------- |
| `tree`        | [`Tree`](../../nx-devkit/index#tree) | the file system tree                                                    |
| `projectName` | `string`                             | unique name. Often directories are part of the name (e.g., mydir-mylib) |

#### Returns

[`ProjectConfiguration`](../../nx-devkit/index#projectconfiguration)

---

### readTargetOptions

▸ **readTargetOptions**<`T`\>(`__namedParameters`, `context`): `T`

Reads and combines options for a given target.

Works as if you invoked the target yourself without passing any command lint overrides.

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Parameters

| Name                | Type                                                       |
| :------------------ | :--------------------------------------------------------- |
| `__namedParameters` | [`Target`](../../nx-devkit/index#target)                   |
| `context`           | [`ExecutorContext`](../../nx-devkit/index#executorcontext) |

#### Returns

`T`

---

### readWorkspaceConfiguration

▸ **readWorkspaceConfiguration**(`tree`): [`WorkspaceConfiguration`](../../nx-devkit/index#workspaceconfiguration)

Read general workspace configuration such as the default project or cli settings

This does _not_ provide projects configuration, use [readProjectConfiguration](../../nx-devkit/index#readprojectconfiguration) instead.

#### Parameters

| Name   | Type                                 |
| :----- | :----------------------------------- |
| `tree` | [`Tree`](../../nx-devkit/index#tree) |

#### Returns

[`WorkspaceConfiguration`](../../nx-devkit/index#workspaceconfiguration)

---

### removeDependenciesFromPackageJson

▸ **removeDependenciesFromPackageJson**(`tree`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](../../nx-devkit/index#generatorcallback)

Remove Dependencies and Dev Dependencies from package.json

For example:

```typescript
removeDependenciesFromPackageJson(tree, ['react'], ['jest']);
```

This will **remove** `react` and `jest` from the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name              | Type                                 | Default value    | Description                                                                 |
| :---------------- | :----------------------------------- | :--------------- | :-------------------------------------------------------------------------- |
| `tree`            | [`Tree`](../../nx-devkit/index#tree) | `undefined`      | -                                                                           |
| `dependencies`    | `string`[]                           | `undefined`      | Dependencies to be removed from the dependencies section of package.json    |
| `devDependencies` | `string`[]                           | `undefined`      | Dependencies to be removed from the devDependencies section of package.json |
| `packageJsonPath` | `string`                             | `'package.json'` | -                                                                           |

#### Returns

[`GeneratorCallback`](../../nx-devkit/index#generatorcallback)

Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.

---

### removeProjectConfiguration

▸ **removeProjectConfiguration**(`tree`, `projectName`): `void`

Removes the configuration of an existing project.

The project configuration is stored in workspace.json or the associated project.json file.
The utility will update either file.

#### Parameters

| Name          | Type                                 |
| :------------ | :----------------------------------- |
| `tree`        | [`Tree`](../../nx-devkit/index#tree) |
| `projectName` | `string`                             |

#### Returns

`void`

---

### reverse

▸ **reverse**(`graph`): [`ProjectGraph`](../../nx-devkit/index#projectgraph)

Returns a new project graph where all the edges are reversed.

For instance, if project A depends on B, in the reversed graph
B will depend on A.

#### Parameters

| Name    | Type                                                         |
| :------ | :----------------------------------------------------------- |
| `graph` | [`ProjectGraph`](../../nx-devkit/index#projectgraph)<`any`\> |

#### Returns

[`ProjectGraph`](../../nx-devkit/index#projectgraph)

---

### runExecutor

▸ **runExecutor**<`T`\>(`targetDescription`, `options`, `context`): `Promise`<`AsyncIterableIterator`<`T`\>\>

Loads and invokes executor.

This is analogous to invoking executor from the terminal, with the exception
that the params aren't parsed from the string, but instead provided parsed already.

Apart from that, it works the same way:

- it will load the workspace configuration
- it will resolve the target
- it will load the executor and the schema
- it will load the options for the appropriate configuration
- it will run the validations and will set the default
- and, of course, it will invoke the executor

Example:

```typescript
for await (const s of await runExecutor(
  { project: 'myproj', target: 'serve' },
  { watch: true },
  context
)) {
  // s.success
}
```

Note that the return value is a promise of an iterator, so you need to await before iterating over it.

#### Type parameters

| Name | Type             |
| :--- | :--------------- |
| `T`  | extends `Object` |

#### Parameters

| Name                               | Type                                                       |
| :--------------------------------- | :--------------------------------------------------------- |
| `targetDescription`                | `Object`                                                   |
| `targetDescription.configuration?` | `string`                                                   |
| `targetDescription.project`        | `string`                                                   |
| `targetDescription.target`         | `string`                                                   |
| `options`                          | `Object`                                                   |
| `context`                          | [`ExecutorContext`](../../nx-devkit/index#executorcontext) |

#### Returns

`Promise`<`AsyncIterableIterator`<`T`\>\>

---

### serializeJson

▸ **serializeJson**<`T`\>(`input`, `options?`): `string`

Serializes the given data to a JSON string.
By default the JSON string is formatted with a 2 space intendation to be easy readable.

#### Type parameters

| Name | Type                        |
| :--- | :-------------------------- |
| `T`  | extends `object` = `object` |

#### Parameters

| Name       | Type                                                                 | Description                               |
| :--------- | :------------------------------------------------------------------- | :---------------------------------------- |
| `input`    | `T`                                                                  | Object which should be serialized to JSON |
| `options?` | [`JsonSerializeOptions`](../../nx-devkit/index#jsonserializeoptions) | JSON serialize options                    |

#### Returns

`string`

the formatted JSON representation of the object

---

### stripIndents

▸ **stripIndents**(`strings`, ...`values`): `string`

Removes indents, which is useful for printing warning and messages.

Example:

```typescript
stripIndents`
 Options:
 - option1
 - option2
`;
```

#### Parameters

| Name        | Type                   |
| :---------- | :--------------------- |
| `strings`   | `TemplateStringsArray` |
| `...values` | `any`[]                |

#### Returns

`string`

---

### stripJsonComments

▸ `Const` **stripJsonComments**(`text`, `replaceCh?`): `string`

Takes JSON with JavaScript-style comments and remove
them. Optionally replaces every none-newline character
of comments with a replaceCharacter

#### Parameters

| Name         | Type     |
| :----------- | :------- |
| `text`       | `string` |
| `replaceCh?` | `string` |

#### Returns

`string`

---

### targetToTargetString

▸ **targetToTargetString**(`target`): `string`

Returns a string in the format "project:target[:configuration]" for the target

#### Parameters

| Name     | Type                                     | Description                                                                                                                                                                                                                                     |
| :------- | :--------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target` | [`Target`](../../nx-devkit/index#target) | target object Examples: `typescript targetToTargetString({ project: "proj", target: "test" }) // returns "proj:test" targetToTargetString({ project: "proj", target: "test", configuration: "production" }) // returns "proj:test:production" ` |

#### Returns

`string`

---

### toJS

▸ **toJS**(`tree`): `void`

Rename and transpile any new typescript files created to javascript files

#### Parameters

| Name   | Type                                 |
| :----- | :----------------------------------- |
| `tree` | [`Tree`](../../nx-devkit/index#tree) |

#### Returns

`void`

---

### updateJson

▸ **updateJson**<`T`, `U`\>(`tree`, `path`, `updater`, `options?`): `void`

Updates a JSON value to the file system tree

#### Type parameters

| Name | Type                     |
| :--- | :----------------------- |
| `T`  | extends `object` = `any` |
| `U`  | extends `object` = `T`   |

#### Parameters

| Name       | Type                                                                                                                                | Description                                                                                          |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `tree`     | [`Tree`](../../nx-devkit/index#tree)                                                                                                | File system tree                                                                                     |
| `path`     | `string`                                                                                                                            | Path of JSON file in the Tree                                                                        |
| `updater`  | (`value`: `T`) => `U`                                                                                                               | Function that maps the current value of a JSON document to a new value to be written to the document |
| `options?` | [`JsonParseOptions`](../../nx-devkit/index#jsonparseoptions) & [`JsonSerializeOptions`](../../nx-devkit/index#jsonserializeoptions) | Optional JSON Parse and Serialize Options                                                            |

#### Returns

`void`

---

### updateProjectConfiguration

▸ **updateProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`): `void`

Updates the configuration of an existing project.

The project configuration is stored in workspace.json or the associated project.json file.
The utility will update either files.

#### Parameters

| Name                   | Type                                                                 | Description                                                             |
| :--------------------- | :------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `tree`                 | [`Tree`](../../nx-devkit/index#tree)                                 | the file system tree                                                    |
| `projectName`          | `string`                                                             | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [`ProjectConfiguration`](../../nx-devkit/index#projectconfiguration) | project configuration                                                   |

#### Returns

`void`

---

### updateTsConfigsToJs

▸ **updateTsConfigsToJs**(`tree`, `options`): `void`

#### Parameters

| Name                  | Type                                 |
| :-------------------- | :----------------------------------- |
| `tree`                | [`Tree`](../../nx-devkit/index#tree) |
| `options`             | `Object`                             |
| `options.projectRoot` | `string`                             |

#### Returns

`void`

---

### updateWorkspaceConfiguration

▸ **updateWorkspaceConfiguration**(`tree`, `workspaceConfig`): `void`

Update general workspace configuration such as the default project or cli settings.

This does _not_ update projects configuration, use [updateProjectConfiguration](../../nx-devkit/index#updateprojectconfiguration) or [addProjectConfiguration](../../nx-devkit/index#addprojectconfiguration) instead.

#### Parameters

| Name              | Type                                                                     |
| :---------------- | :----------------------------------------------------------------------- |
| `tree`            | [`Tree`](../../nx-devkit/index#tree)                                     |
| `workspaceConfig` | [`WorkspaceConfiguration`](../../nx-devkit/index#workspaceconfiguration) |

#### Returns

`void`

---

### visitNotIgnoredFiles

▸ **visitNotIgnoredFiles**(`tree`, `dirPath?`, `visitor`): `void`

Utility to act on all files in a tree that are not ignored by git.

#### Parameters

| Name      | Type                                 | Default value |
| :-------- | :----------------------------------- | :------------ |
| `tree`    | [`Tree`](../../nx-devkit/index#tree) | `undefined`   |
| `dirPath` | `string`                             | `tree.root`   |
| `visitor` | (`path`: `string`) => `void`         | `undefined`   |

#### Returns

`void`

---

### workspaceLayout

▸ **workspaceLayout**(): `Object`

Returns information about where apps and libs will be created.

#### Returns

`Object`

| Name      | Type     |
| :-------- | :------- |
| `appsDir` | `string` |
| `libsDir` | `string` |

---

### writeJson

▸ **writeJson**<`T`\>(`tree`, `path`, `value`, `options?`): `void`

Writes a JSON value to the file system tree

#### Type parameters

| Name | Type                        |
| :--- | :-------------------------- |
| `T`  | extends `object` = `object` |

#### Parameters

| Name       | Type                                                                 | Description                     |
| :--------- | :------------------------------------------------------------------- | :------------------------------ |
| `tree`     | [`Tree`](../../nx-devkit/index#tree)                                 | File system tree                |
| `path`     | `string`                                                             | Path of JSON file in the Tree   |
| `value`    | `T`                                                                  | Serializable value to write     |
| `options?` | [`JsonSerializeOptions`](../../nx-devkit/index#jsonserializeoptions) | Optional JSON Serialize Options |

#### Returns

`void`

---

### writeJsonFile

▸ **writeJsonFile**<`T`\>(`path`, `data`, `options?`): `void`

Serializes the given data to JSON and writes it to a file.

#### Type parameters

| Name | Type                        |
| :--- | :-------------------------- |
| `T`  | extends `object` = `object` |

#### Parameters

| Name       | Type               | Description                                                     |
| :--------- | :----------------- | :-------------------------------------------------------------- |
| `path`     | `string`           | A path to a file.                                               |
| `data`     | `T`                | data which should be serialized to JSON and written to the file |
| `options?` | `JsonWriteOptions` | JSON serialize options                                          |

#### Returns

`void`
