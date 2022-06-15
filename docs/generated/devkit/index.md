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

- [DependencyType](../../devkit/index#dependencytype)

### Utils Enumerations

- [ChangeType](../../devkit/index#changetype)

### Project Graph Classes

- [ProjectGraphBuilder](../../devkit/index#projectgraphbuilder)

### Utils Classes

- [Hasher](../../devkit/index#hasher)

### Workspace Classes

- [Workspaces](../../devkit/index#workspaces)

### Commands Interfaces

- [Target](../../devkit/index#target)

### Other Interfaces

- [NxPlugin](../../devkit/index#nxplugin)

### Project Graph Interfaces

- [FileData](../../devkit/index#filedata)
- [ProjectFileMap](../../devkit/index#projectfilemap)
- [ProjectGraph](../../devkit/index#projectgraph)
- [ProjectGraphDependency](../../devkit/index#projectgraphdependency)
- [ProjectGraphExternalNode](../../devkit/index#projectgraphexternalnode)
- [ProjectGraphProcessorContext](../../devkit/index#projectgraphprocessorcontext)
- [ProjectGraphProjectNode](../../devkit/index#projectgraphprojectnode)
- [ProjectGraphV4](../../devkit/index#projectgraphv4)

### Tree Interfaces

- [FileChange](../../devkit/index#filechange)
- [Tree](../../devkit/index#tree)

### Utils Interfaces

- [DefaultTasksRunnerOptions](../../devkit/index#defaulttasksrunneroptions)
- [Hash](../../devkit/index#hash)
- [JsonParseOptions](../../devkit/index#jsonparseoptions)
- [JsonSerializeOptions](../../devkit/index#jsonserializeoptions)
- [RemoteCache](../../devkit/index#remotecache)
- [StringDeletion](../../devkit/index#stringdeletion)
- [StringInsertion](../../devkit/index#stringinsertion)

### Workspace Interfaces

- [ExecutorContext](../../devkit/index#executorcontext)
- [ExecutorsJson](../../devkit/index#executorsjson)
- [GeneratorsJson](../../devkit/index#generatorsjson)
- [HasherContext](../../devkit/index#hashercontext)
- [ImplicitJsonSubsetDependency](../../devkit/index#implicitjsonsubsetdependency)
- [MigrationsJson](../../devkit/index#migrationsjson)
- [NxAffectedConfig](../../devkit/index#nxaffectedconfig)
- [NxJsonConfiguration](../../devkit/index#nxjsonconfiguration)
- [ProjectConfiguration](../../devkit/index#projectconfiguration)
- [ProjectsConfigurations](../../devkit/index#projectsconfigurations)
- [TargetConfiguration](../../devkit/index#targetconfiguration)
- [TargetDependencyConfig](../../devkit/index#targetdependencyconfig)
- [Task](../../devkit/index#task)
- [TaskGraph](../../devkit/index#taskgraph)
- [Workspace](../../devkit/index#workspace)

### Generators Type aliases

- [WorkspaceConfiguration](../../devkit/index#workspaceconfiguration)

### Other Type aliases

- [ProjectTargetConfigurator](../../devkit/index#projecttargetconfigurator)

### Package Manager Type aliases

- [PackageManager](../../devkit/index#packagemanager)

### Project Graph Type aliases

- [ProjectGraphNode](../../devkit/index#projectgraphnode)

### Utils Type aliases

- [StringChange](../../devkit/index#stringchange)

### Workspace Type aliases

- [CustomHasher](../../devkit/index#customhasher)
- [Executor](../../devkit/index#executor)
- [Generator](../../devkit/index#generator)
- [GeneratorCallback](../../devkit/index#generatorcallback)
- [ImplicitDependencyEntry](../../devkit/index#implicitdependencyentry)
- [ProjectType](../../devkit/index#projecttype)
- [TaskGraphExecutor](../../devkit/index#taskgraphexecutor)
- [WorkspaceJsonConfiguration](../../devkit/index#workspacejsonconfiguration)

### Logger Variables

- [logger](../../devkit/index#logger)

### Utils Variables

- [appRootPath](../../devkit/index#approotpath)
- [cacheDir](../../devkit/index#cachedir)
- [output](../../devkit/index#output)
- [workspaceRoot](../../devkit/index#workspaceroot)

### Functions

- [addDependenciesToPackageJson](../../devkit/index#adddependenciestopackagejson)
- [addProjectConfiguration](../../devkit/index#addprojectconfiguration)
- [applyChangesToString](../../devkit/index#applychangestostring)
- [convertNxExecutor](../../devkit/index#convertnxexecutor)
- [convertNxGenerator](../../devkit/index#convertnxgenerator)
- [createProjectGraphAsync](../../devkit/index#createprojectgraphasync)
- [defaultTasksRunner](../../devkit/index#defaulttasksrunner)
- [detectPackageManager](../../devkit/index#detectpackagemanager)
- [formatFiles](../../devkit/index#formatfiles)
- [generateFiles](../../devkit/index#generatefiles)
- [getOutputsForTargetAndConfiguration](../../devkit/index#getoutputsfortargetandconfiguration)
- [getPackageManagerCommand](../../devkit/index#getpackagemanagercommand)
- [getPackageManagerVersion](../../devkit/index#getpackagemanagerversion)
- [getProjects](../../devkit/index#getprojects)
- [getWorkspaceLayout](../../devkit/index#getworkspacelayout)
- [getWorkspacePath](../../devkit/index#getworkspacepath)
- [installPackagesTask](../../devkit/index#installpackagestask)
- [isStandaloneProject](../../devkit/index#isstandaloneproject)
- [joinPathFragments](../../devkit/index#joinpathfragments)
- [moveFilesToNewDirectory](../../devkit/index#movefilestonewdirectory)
- [names](../../devkit/index#names)
- [normalizePath](../../devkit/index#normalizepath)
- [offsetFromRoot](../../devkit/index#offsetfromroot)
- [parseJson](../../devkit/index#parsejson)
- [parseTargetString](../../devkit/index#parsetargetstring)
- [readAllWorkspaceConfiguration](../../devkit/index#readallworkspaceconfiguration)
- [readCachedProjectGraph](../../devkit/index#readcachedprojectgraph)
- [readJson](../../devkit/index#readjson)
- [readJsonFile](../../devkit/index#readjsonfile)
- [readNxJson](../../devkit/index#readnxjson)
- [readProjectConfiguration](../../devkit/index#readprojectconfiguration)
- [readTargetOptions](../../devkit/index#readtargetoptions)
- [readWorkspaceConfiguration](../../devkit/index#readworkspaceconfiguration)
- [removeDependenciesFromPackageJson](../../devkit/index#removedependenciesfrompackagejson)
- [removeProjectConfiguration](../../devkit/index#removeprojectconfiguration)
- [reverse](../../devkit/index#reverse)
- [runExecutor](../../devkit/index#runexecutor)
- [serializeJson](../../devkit/index#serializejson)
- [stripIndents](../../devkit/index#stripindents)
- [stripJsonComments](../../devkit/index#stripjsoncomments)
- [targetToTargetString](../../devkit/index#targettotargetstring)
- [toJS](../../devkit/index#tojs)
- [updateJson](../../devkit/index#updatejson)
- [updateProjectConfiguration](../../devkit/index#updateprojectconfiguration)
- [updateTsConfigsToJs](../../devkit/index#updatetsconfigstojs)
- [updateWorkspaceConfiguration](../../devkit/index#updateworkspaceconfiguration)
- [visitNotIgnoredFiles](../../devkit/index#visitnotignoredfiles)
- [workspaceLayout](../../devkit/index#workspacelayout)
- [writeJson](../../devkit/index#writejson)
- [writeJsonFile](../../devkit/index#writejsonfile)

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

### ExecutorsJson

• **ExecutorsJson**: `Object`

---

### GeneratorsJson

• **GeneratorsJson**: `Object`

---

### HasherContext

• **HasherContext**: `Object`

---

### ImplicitJsonSubsetDependency

• **ImplicitJsonSubsetDependency**<`T`\>: `Object`

#### Type parameters

| Name | Type                |
| :--- | :------------------ |
| `T`  | `"*"` \| `string`[] |

---

### MigrationsJson

• **MigrationsJson**: `Object`

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

### ProjectConfiguration

• **ProjectConfiguration**: `Object`

---

### ProjectsConfigurations

• **ProjectsConfigurations**: `Object`

---

### TargetConfiguration

• **TargetConfiguration**<`T`\>: `Object`

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

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

## Generators Type aliases

### WorkspaceConfiguration

Ƭ **WorkspaceConfiguration**: `Omit`<[`ProjectsConfigurations`](../../devkit/index#projectsconfigurations), `"projects"`\> & `Partial`<[`NxJsonConfiguration`](../../devkit/index#nxjsonconfiguration)\>

---

## Other Type aliases

### ProjectTargetConfigurator

Ƭ **ProjectTargetConfigurator**: (`file`: `string`) => `Record`<`string`, [`TargetConfiguration`](../../devkit/index#targetconfiguration)\>

#### Type declaration

▸ (`file`): `Record`<`string`, [`TargetConfiguration`](../../devkit/index#targetconfiguration)\>

##### Parameters

| Name   | Type     |
| :----- | :------- |
| `file` | `string` |

##### Returns

`Record`<`string`, [`TargetConfiguration`](../../devkit/index#targetconfiguration)\>

---

## Package Manager Type aliases

### PackageManager

Ƭ **PackageManager**: `"yarn"` \| `"pnpm"` \| `"npm"`

---

## Project Graph Type aliases

### ProjectGraphNode

Ƭ **ProjectGraphNode**<`T`\>: [`ProjectGraphProjectNode`](../../devkit/index#projectgraphprojectnode)<`T`\> \| [`ProjectGraphExternalNode`](../../devkit/index#projectgraphexternalnode)

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

---

## Utils Type aliases

### StringChange

Ƭ **StringChange**: [`StringInsertion`](../../devkit/index#stringinsertion) \| [`StringDeletion`](../../devkit/index#stringdeletion)

---

## Workspace Type aliases

### CustomHasher

Ƭ **CustomHasher**: (`task`: [`Task`](../../devkit/index#task), `context`: [`HasherContext`](../../devkit/index#hashercontext)) => `Promise`<[`Hash`](../../devkit/index#hash)\>

#### Type declaration

▸ (`task`, `context`): `Promise`<[`Hash`](../../devkit/index#hash)\>

##### Parameters

| Name      | Type                                                |
| :-------- | :-------------------------------------------------- |
| `task`    | [`Task`](../../devkit/index#task)                   |
| `context` | [`HasherContext`](../../devkit/index#hashercontext) |

##### Returns

`Promise`<[`Hash`](../../devkit/index#hash)\>

---

### Executor

Ƭ **Executor**<`T`\>: (`options`: `T`, `context`: [`ExecutorContext`](../../devkit/index#executorcontext)) => `Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`options`, `context`): `Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

Implementation of a target of a project

##### Parameters

| Name      | Type                                                    |
| :-------- | :------------------------------------------------------ |
| `options` | `T`                                                     |
| `context` | [`ExecutorContext`](../../devkit/index#executorcontext) |

##### Returns

`Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

---

### Generator

Ƭ **Generator**<`T`\>: (`tree`: `any`, `schema`: `T`) => `void` \| [`GeneratorCallback`](../../devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../devkit/index#generatorcallback)\>

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`tree`, `schema`): `void` \| [`GeneratorCallback`](../../devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../devkit/index#generatorcallback)\>

A function that schedules updates to the filesystem to be done atomically

##### Parameters

| Name     | Type  |
| :------- | :---- |
| `tree`   | `any` |
| `schema` | `T`   |

##### Returns

`void` \| [`GeneratorCallback`](../../devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../devkit/index#generatorcallback)\>

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

▪ [key: `string`]: `T` \| [`ImplicitJsonSubsetDependency`](../../devkit/index#implicitjsonsubsetdependency)<`T`\>

---

### ProjectType

Ƭ **ProjectType**: `"library"` \| `"application"`

---

### TaskGraphExecutor

Ƭ **TaskGraphExecutor**<`T`\>: (`taskGraph`: [`TaskGraph`](../../devkit/index#taskgraph), `options`: `Record`<`string`, `T`\>, `overrides`: `T`, `context`: [`ExecutorContext`](../../devkit/index#executorcontext)) => `Promise`<`Record`<`string`, `Object`\>\>

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`taskGraph`, `options`, `overrides`, `context`): `Promise`<`Record`<`string`, `Object`\>\>

Implementation of a target of a project that handles multiple projects to be batched

##### Parameters

| Name        | Type                                                    |
| :---------- | :------------------------------------------------------ |
| `taskGraph` | [`TaskGraph`](../../devkit/index#taskgraph)             |
| `options`   | `Record`<`string`, `T`\>                                |
| `overrides` | `T`                                                     |
| `context`   | [`ExecutorContext`](../../devkit/index#executorcontext) |

##### Returns

`Promise`<`Record`<`string`, `Object`\>\>

---

### WorkspaceJsonConfiguration

Ƭ **WorkspaceJsonConfiguration**: [`ProjectsConfigurations`](../../devkit/index#projectsconfigurations)

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

• **appRootPath**: `string` = `workspaceRoot`

---

### cacheDir

• **cacheDir**: `string`

---

### output

• **output**: `CLIOutput`

---

### workspaceRoot

• **workspaceRoot**: `string`

## Functions

### addDependenciesToPackageJson

▸ **addDependenciesToPackageJson**(`tree`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](../../devkit/index#generatorcallback)

Add Dependencies and Dev Dependencies to package.json

For example:

```typescript
addDependenciesToPackageJson(tree, { react: 'latest' }, { jest: 'latest' });
```

This will **add** `react` and `jest` to the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name              | Type                              | Default value    | Description                                                             |
| :---------------- | :-------------------------------- | :--------------- | :---------------------------------------------------------------------- |
| `tree`            | [`Tree`](../../devkit/index#tree) | `undefined`      | Tree representing file system to modify                                 |
| `dependencies`    | `Record`<`string`, `string`\>     | `undefined`      | Dependencies to be added to the dependencies section of package.json    |
| `devDependencies` | `Record`<`string`, `string`\>     | `undefined`      | Dependencies to be added to the devDependencies section of package.json |
| `packageJsonPath` | `string`                          | `'package.json'` | Path to package.json                                                    |

#### Returns

[`GeneratorCallback`](../../devkit/index#generatorcallback)

Callback to install dependencies only if necessary. undefined is returned if changes are not necessary.

---

### addProjectConfiguration

▸ **addProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`, `standalone?`): `void`

Adds project configuration to the Nx workspace.

The project configuration is stored in workspace.json or the associated project.json file.
The utility will update either files.

#### Parameters

| Name                   | Type                                                              | Description                                                                                |
| :--------------------- | :---------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `tree`                 | [`Tree`](../../devkit/index#tree)                                 | the file system tree                                                                       |
| `projectName`          | `string`                                                          | unique name. Often directories are part of the name (e.g., mydir-mylib)                    |
| `projectConfiguration` | [`ProjectConfiguration`](../../devkit/index#projectconfiguration) | project configuration                                                                      |
| `standalone?`          | `boolean`                                                         | should the project use package.json? If false, the project config is inside workspace.json |

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

| Name      | Type                                                |
| :-------- | :-------------------------------------------------- |
| `text`    | `string`                                            |
| `changes` | [`StringChange`](../../devkit/index#stringchange)[] |

#### Returns

`string`

---

### convertNxExecutor

▸ **convertNxExecutor**(`executor`): `any`

Convert an Nx Executor into an Angular Devkit Builder

Use this to expose a compatible Angular Builder

#### Parameters

| Name       | Type                                              |
| :--------- | :------------------------------------------------ |
| `executor` | [`Executor`](../../devkit/index#executor)<`any`\> |

#### Returns

`any`

---

### convertNxGenerator

▸ **convertNxGenerator**<`T`\>(`generator`, `skipWritingConfigInOldFormat?`): (`generatorOptions`: `T`) => (`tree`: `any`, `context`: `any`) => `Promise`<`any`\>

Convert an Nx Generator into an Angular Devkit Schematic.

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Parameters

| Name                           | Type                                              | Default value | Description                                                                                       |
| :----------------------------- | :------------------------------------------------ | :------------ | :------------------------------------------------------------------------------------------------ |
| `generator`                    | [`Generator`](../../devkit/index#generator)<`T`\> | `undefined`   | The Nx generator to convert to an Angular Devkit Schematic.                                       |
| `skipWritingConfigInOldFormat` | `boolean`                                         | `false`       | Whether to skip writing the configuration in the old format (the one used by the Angular DevKit). |

#### Returns

`fn`

▸ (`generatorOptions`): (`tree`: `any`, `context`: `any`) => `Promise`<`any`\>

##### Parameters

| Name               | Type |
| :----------------- | :--- |
| `generatorOptions` | `T`  |

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

▸ **createProjectGraphAsync**(): `Promise`<[`ProjectGraph`](../../devkit/index#projectgraph)\>

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

`Promise`<[`ProjectGraph`](../../devkit/index#projectgraph)\>

---

### defaultTasksRunner

▸ `Const` **defaultTasksRunner**(`tasks`, `options`, `context?`): `any`

#### Parameters

| Name                         | Type                                                                                  |
| :--------------------------- | :------------------------------------------------------------------------------------ |
| `tasks`                      | [`Task`](../../devkit/index#task)[]                                                   |
| `options`                    | [`DefaultTasksRunnerOptions`](../../devkit/index#defaulttasksrunneroptions)           |
| `context?`                   | `Object`                                                                              |
| `context.initiatingProject?` | `string`                                                                              |
| `context.nxArgs`             | `NxArgs`                                                                              |
| `context.nxJson`             | [`NxJsonConfiguration`](../../devkit/index#nxjsonconfiguration)<`string`[] \| `"*"`\> |
| `context.projectGraph`       | [`ProjectGraph`](../../devkit/index#projectgraph)<`any`\>                             |
| `context.target?`            | `string`                                                                              |
| `context.taskGraph?`         | [`TaskGraph`](../../devkit/index#taskgraph)                                           |

#### Returns

`any`

---

### detectPackageManager

▸ **detectPackageManager**(`dir?`): [`PackageManager`](../../devkit/index#packagemanager)

Detects which package manager is used in the workspace based on the lock file.

#### Parameters

| Name  | Type     | Default value |
| :---- | :------- | :------------ |
| `dir` | `string` | `''`          |

#### Returns

[`PackageManager`](../../devkit/index#packagemanager)

---

### formatFiles

▸ **formatFiles**(`tree`): `Promise`<`void`\>

Formats all the created or updated files using Prettier

#### Parameters

| Name   | Type                              | Description          |
| :----- | :-------------------------------- | :------------------- |
| `tree` | [`Tree`](../../devkit/index#tree) | the file system tree |

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

| Name            | Type                              | Description                                   |
| :-------------- | :-------------------------------- | :-------------------------------------------- |
| `tree`          | [`Tree`](../../devkit/index#tree) | the file system tree                          |
| `srcFolder`     | `string`                          | the source folder of files (absolute path)    |
| `target`        | `string`                          | the target folder (relative to the tree root) |
| `substitutions` | `Object`                          | an object of key-value pairs                  |

#### Returns

`void`

---

### getOutputsForTargetAndConfiguration

▸ **getOutputsForTargetAndConfiguration**(`task`, `node`): `any`

Returns the list of outputs that will be cached.

#### Parameters

| Name   | Type                                                                            | Description                                               |
| :----- | :------------------------------------------------------------------------------ | :-------------------------------------------------------- |
| `task` | `Pick`<[`Task`](../../devkit/index#task), `"target"` \| `"overrides"`\>         | target + overrides                                        |
| `node` | [`ProjectGraphProjectNode`](../../devkit/index#projectgraphprojectnode)<`any`\> | ProjectGraphProjectNode object that the task runs against |

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

| Name             | Type                                                  |
| :--------------- | :---------------------------------------------------- |
| `packageManager` | [`PackageManager`](../../devkit/index#packagemanager) |

#### Returns

`PackageManagerCommands`

---

### getPackageManagerVersion

▸ **getPackageManagerVersion**(`packageManager?`): `string`

Returns the version of the package manager used in the workspace.
By default, the package manager is derived based on the lock file,
but it can also be passed in explicitly.

#### Parameters

| Name             | Type                                                  |
| :--------------- | :---------------------------------------------------- |
| `packageManager` | [`PackageManager`](../../devkit/index#packagemanager) |

#### Returns

`string`

---

### getProjects

▸ **getProjects**(`tree`): `Map`<`string`, [`ProjectConfiguration`](../../devkit/index#projectconfiguration)\>

Get a map of all projects in a workspace.

Use [readProjectConfiguration](../../devkit/index#readprojectconfiguration) if only one project is needed.

#### Parameters

| Name   | Type                              |
| :----- | :-------------------------------- |
| `tree` | [`Tree`](../../devkit/index#tree) |

#### Returns

`Map`<`string`, [`ProjectConfiguration`](../../devkit/index#projectconfiguration)\>

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

| Name   | Type                              | Description      |
| :----- | :-------------------------------- | :--------------- |
| `tree` | [`Tree`](../../devkit/index#tree) | file system tree |

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

| Name   | Type                              |
| :----- | :-------------------------------- |
| `tree` | [`Tree`](../../devkit/index#tree) |

#### Returns

`"/angular.json"` \| `"/workspace.json"` \| `null`

---

### installPackagesTask

▸ **installPackagesTask**(`tree`, `alwaysRun?`, `cwd?`, `packageManager?`): `void`

Runs `npm install` or `yarn install`. It will skip running the install if
`package.json` hasn't changed at all or it hasn't changed since the last invocation.

#### Parameters

| Name             | Type                                                  | Default value | Description                                                   |
| :--------------- | :---------------------------------------------------- | :------------ | :------------------------------------------------------------ |
| `tree`           | [`Tree`](../../devkit/index#tree)                     | `undefined`   | the file system tree                                          |
| `alwaysRun`      | `boolean`                                             | `false`       | always run the command even if `package.json` hasn't changed. |
| `cwd`            | `string`                                              | `''`          | -                                                             |
| `packageManager` | [`PackageManager`](../../devkit/index#packagemanager) | `undefined`   | -                                                             |

#### Returns

`void`

---

### isStandaloneProject

▸ **isStandaloneProject**(`tree`, `project`): `boolean`

Returns if a project has a standalone configuration (project.json).

#### Parameters

| Name      | Type                              | Description          |
| :-------- | :-------------------------------- | :------------------- |
| `tree`    | [`Tree`](../../devkit/index#tree) | the file system tree |
| `project` | `string`                          | the project name     |

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

| Name     | Type                              |
| :------- | :-------------------------------- |
| `tree`   | [`Tree`](../../devkit/index#tree) |
| `oldDir` | `string`                          |
| `newDir` | `string`                          |

#### Returns

`void`

---

### names

▸ **names**(`name`): `Object`

Util function to generate different strings based off the provided name.

Examples:

```typescript
names('my-name'); // {name: 'my-name', className: 'MyName', propertyName: 'myName', constantName: 'MY_NAME', fileName: 'my-name'}
names('myName'); // {name: 'myName', className: 'MyName', propertyName: 'myName', constantName: 'MY_NAME', fileName: 'my-name'}
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

| Name       | Type                                                      | Description            |
| :--------- | :-------------------------------------------------------- | :--------------------- |
| `input`    | `string`                                                  | JSON content as string |
| `options?` | [`JsonParseOptions`](../../devkit/index#jsonparseoptions) | JSON parse options     |

#### Returns

`T`

Object the JSON content represents

---

### parseTargetString

▸ **parseTargetString**(`targetString`): [`Target`](../../devkit/index#target)

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

[`Target`](../../devkit/index#target)

---

### readAllWorkspaceConfiguration

▸ **readAllWorkspaceConfiguration**(): [`ProjectsConfigurations`](../../devkit/index#projectsconfigurations) & [`NxJsonConfiguration`](../../devkit/index#nxjsonconfiguration)

#### Returns

[`ProjectsConfigurations`](../../devkit/index#projectsconfigurations) & [`NxJsonConfiguration`](../../devkit/index#nxjsonconfiguration)

---

### readCachedProjectGraph

▸ **readCachedProjectGraph**(): [`ProjectGraph`](../../devkit/index#projectgraph)

Synchronously reads the latest cached copy of the workspace's ProjectGraph.

**`throws`** {Error} if there is no cached ProjectGraph to read from

#### Returns

[`ProjectGraph`](../../devkit/index#projectgraph)

---

### readJson

▸ **readJson**<`T`\>(`tree`, `path`, `options?`): `T`

Reads a json file, removes all comments and parses JSON.

#### Type parameters

| Name | Type                     |
| :--- | :----------------------- |
| `T`  | extends `object` = `any` |

#### Parameters

| Name       | Type                                                      | Description                 |
| :--------- | :-------------------------------------------------------- | :-------------------------- |
| `tree`     | [`Tree`](../../devkit/index#tree)                         | file system tree            |
| `path`     | `string`                                                  | file path                   |
| `options?` | [`JsonParseOptions`](../../devkit/index#jsonparseoptions) | Optional JSON Parse Options |

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

▸ **readNxJson**(): [`NxJsonConfiguration`](../../devkit/index#nxjsonconfiguration)

#### Returns

[`NxJsonConfiguration`](../../devkit/index#nxjsonconfiguration)

---

### readProjectConfiguration

▸ **readProjectConfiguration**(`tree`, `projectName`): [`ProjectConfiguration`](../../devkit/index#projectconfiguration)

Reads a project configuration.

The project configuration is stored in workspace.json or the associated project.json file.
The utility will read from either file.

**`throws`** If supplied projectName cannot be found

#### Parameters

| Name          | Type                              | Description                                                             |
| :------------ | :-------------------------------- | :---------------------------------------------------------------------- |
| `tree`        | [`Tree`](../../devkit/index#tree) | the file system tree                                                    |
| `projectName` | `string`                          | unique name. Often directories are part of the name (e.g., mydir-mylib) |

#### Returns

[`ProjectConfiguration`](../../devkit/index#projectconfiguration)

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

| Name                | Type                                                    |
| :------------------ | :------------------------------------------------------ |
| `__namedParameters` | [`Target`](../../devkit/index#target)                   |
| `context`           | [`ExecutorContext`](../../devkit/index#executorcontext) |

#### Returns

`T`

---

### readWorkspaceConfiguration

▸ **readWorkspaceConfiguration**(`tree`): [`WorkspaceConfiguration`](../../devkit/index#workspaceconfiguration)

Read general workspace configuration such as the default project or cli settings

This does _not_ provide projects configuration, use [readProjectConfiguration](../../devkit/index#readprojectconfiguration) instead.

#### Parameters

| Name   | Type                              |
| :----- | :-------------------------------- |
| `tree` | [`Tree`](../../devkit/index#tree) |

#### Returns

[`WorkspaceConfiguration`](../../devkit/index#workspaceconfiguration)

---

### removeDependenciesFromPackageJson

▸ **removeDependenciesFromPackageJson**(`tree`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](../../devkit/index#generatorcallback)

Remove Dependencies and Dev Dependencies from package.json

For example:

```typescript
removeDependenciesFromPackageJson(tree, ['react'], ['jest']);
```

This will **remove** `react` and `jest` from the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name              | Type                              | Default value    | Description                                                                 |
| :---------------- | :-------------------------------- | :--------------- | :-------------------------------------------------------------------------- |
| `tree`            | [`Tree`](../../devkit/index#tree) | `undefined`      | -                                                                           |
| `dependencies`    | `string`[]                        | `undefined`      | Dependencies to be removed from the dependencies section of package.json    |
| `devDependencies` | `string`[]                        | `undefined`      | Dependencies to be removed from the devDependencies section of package.json |
| `packageJsonPath` | `string`                          | `'package.json'` | -                                                                           |

#### Returns

[`GeneratorCallback`](../../devkit/index#generatorcallback)

Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.

---

### removeProjectConfiguration

▸ **removeProjectConfiguration**(`tree`, `projectName`): `void`

Removes the configuration of an existing project.

The project configuration is stored in workspace.json or the associated project.json file.
The utility will update either file.

#### Parameters

| Name          | Type                              |
| :------------ | :-------------------------------- |
| `tree`        | [`Tree`](../../devkit/index#tree) |
| `projectName` | `string`                          |

#### Returns

`void`

---

### reverse

▸ **reverse**(`graph`): [`ProjectGraph`](../../devkit/index#projectgraph)

Returns a new project graph where all the edges are reversed.

For instance, if project A depends on B, in the reversed graph
B will depend on A.

#### Parameters

| Name    | Type                                                      |
| :------ | :-------------------------------------------------------- |
| `graph` | [`ProjectGraph`](../../devkit/index#projectgraph)<`any`\> |

#### Returns

[`ProjectGraph`](../../devkit/index#projectgraph)

---

### runExecutor

▸ **runExecutor**<`T`\>(`targetDescription`, `overrides`, `context`): `Promise`<`AsyncIterableIterator`<`T`\>\>

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

| Name                               | Type                                                    |
| :--------------------------------- | :------------------------------------------------------ |
| `targetDescription`                | `Object`                                                |
| `targetDescription.configuration?` | `string`                                                |
| `targetDescription.project`        | `string`                                                |
| `targetDescription.target`         | `string`                                                |
| `overrides`                        | `Object`                                                |
| `context`                          | [`ExecutorContext`](../../devkit/index#executorcontext) |

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

| Name       | Type                                                              | Description                               |
| :--------- | :---------------------------------------------------------------- | :---------------------------------------- |
| `input`    | `T`                                                               | Object which should be serialized to JSON |
| `options?` | [`JsonSerializeOptions`](../../devkit/index#jsonserializeoptions) | JSON serialize options                    |

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

| Name     | Type                                  | Description                                                                                                                                                                                                                                     |
| :------- | :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target` | [`Target`](../../devkit/index#target) | target object Examples: `typescript targetToTargetString({ project: "proj", target: "test" }) // returns "proj:test" targetToTargetString({ project: "proj", target: "test", configuration: "production" }) // returns "proj:test:production" ` |

#### Returns

`string`

---

### toJS

▸ **toJS**(`tree`): `void`

Rename and transpile any new typescript files created to javascript files

#### Parameters

| Name   | Type                              |
| :----- | :-------------------------------- |
| `tree` | [`Tree`](../../devkit/index#tree) |

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

| Name       | Type                                                                                                                          | Description                                                                                          |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `tree`     | [`Tree`](../../devkit/index#tree)                                                                                             | File system tree                                                                                     |
| `path`     | `string`                                                                                                                      | Path of JSON file in the Tree                                                                        |
| `updater`  | (`value`: `T`) => `U`                                                                                                         | Function that maps the current value of a JSON document to a new value to be written to the document |
| `options?` | [`JsonParseOptions`](../../devkit/index#jsonparseoptions) & [`JsonSerializeOptions`](../../devkit/index#jsonserializeoptions) | Optional JSON Parse and Serialize Options                                                            |

#### Returns

`void`

---

### updateProjectConfiguration

▸ **updateProjectConfiguration**(`tree`, `projectName`, `projectConfiguration`): `void`

Updates the configuration of an existing project.

The project configuration is stored in workspace.json or the associated project.json file.
The utility will update either files.

#### Parameters

| Name                   | Type                                                              | Description                                                             |
| :--------------------- | :---------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `tree`                 | [`Tree`](../../devkit/index#tree)                                 | the file system tree                                                    |
| `projectName`          | `string`                                                          | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [`ProjectConfiguration`](../../devkit/index#projectconfiguration) | project configuration                                                   |

#### Returns

`void`

---

### updateTsConfigsToJs

▸ **updateTsConfigsToJs**(`tree`, `options`): `void`

#### Parameters

| Name                  | Type                              |
| :-------------------- | :-------------------------------- |
| `tree`                | [`Tree`](../../devkit/index#tree) |
| `options`             | `Object`                          |
| `options.projectRoot` | `string`                          |

#### Returns

`void`

---

### updateWorkspaceConfiguration

▸ **updateWorkspaceConfiguration**(`tree`, `workspaceConfig`): `void`

Update general workspace configuration such as the default project or cli settings.

This does _not_ update projects configuration, use [updateProjectConfiguration](../../devkit/index#updateprojectconfiguration) or [addProjectConfiguration](../../devkit/index#addprojectconfiguration) instead.

#### Parameters

| Name              | Type                                                                  |
| :---------------- | :-------------------------------------------------------------------- |
| `tree`            | [`Tree`](../../devkit/index#tree)                                     |
| `workspaceConfig` | [`WorkspaceConfiguration`](../../devkit/index#workspaceconfiguration) |

#### Returns

`void`

---

### visitNotIgnoredFiles

▸ **visitNotIgnoredFiles**(`tree`, `dirPath?`, `visitor`): `void`

Utility to act on all files in a tree that are not ignored by git.

#### Parameters

| Name      | Type                              | Default value |
| :-------- | :-------------------------------- | :------------ |
| `tree`    | [`Tree`](../../devkit/index#tree) | `undefined`   |
| `dirPath` | `string`                          | `tree.root`   |
| `visitor` | (`path`: `string`) => `void`      | `undefined`   |

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

| Name       | Type                                                              | Description                     |
| :--------- | :---------------------------------------------------------------- | :------------------------------ |
| `tree`     | [`Tree`](../../devkit/index#tree)                                 | File system tree                |
| `path`     | `string`                                                          | Path of JSON file in the Tree   |
| `value`    | `T`                                                               | Serializable value to write     |
| `options?` | [`JsonSerializeOptions`](../../devkit/index#jsonserializeoptions) | Optional JSON Serialize Options |

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
