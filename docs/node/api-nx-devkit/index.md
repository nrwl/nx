# Module: index

## Table of contents

### Enumerations

- [ChangeType](../../node/nx-devkit/index#changetype)
- [DependencyType](../../node/nx-devkit/index#dependencytype)

### Classes

- [ProjectGraphBuilder](../../node/nx-devkit/index#projectgraphbuilder)

### Interfaces

- [ExecutorContext](../../node/nx-devkit/index#executorcontext)
- [FileChange](../../node/nx-devkit/index#filechange)
- [FileData](../../node/nx-devkit/index#filedata)
- [ImplicitJsonSubsetDependency](../../node/nx-devkit/index#implicitjsonsubsetdependency)
- [JsonParseOptions](../../node/nx-devkit/index#jsonparseoptions)
- [JsonSerializeOptions](../../node/nx-devkit/index#jsonserializeoptions)
- [NxAffectedConfig](../../node/nx-devkit/index#nxaffectedconfig)
- [NxJsonConfiguration](../../node/nx-devkit/index#nxjsonconfiguration)
- [NxJsonProjectConfiguration](../../node/nx-devkit/index#nxjsonprojectconfiguration)
- [NxPlugin](../../node/nx-devkit/index#nxplugin)
- [ProjectConfiguration](../../node/nx-devkit/index#projectconfiguration)
- [ProjectFileMap](../../node/nx-devkit/index#projectfilemap)
- [ProjectGraph](../../node/nx-devkit/index#projectgraph)
- [ProjectGraphDependency](../../node/nx-devkit/index#projectgraphdependency)
- [ProjectGraphNode](../../node/nx-devkit/index#projectgraphnode)
- [ProjectGraphProcessorContext](../../node/nx-devkit/index#projectgraphprocessorcontext)
- [StringDeletion](../../node/nx-devkit/index#stringdeletion)
- [StringInsertion](../../node/nx-devkit/index#stringinsertion)
- [Target](../../node/nx-devkit/index#target)
- [TargetConfiguration](../../node/nx-devkit/index#targetconfiguration)
- [TargetDependencyConfig](../../node/nx-devkit/index#targetdependencyconfig)
- [Task](../../node/nx-devkit/index#task)
- [TaskGraph](../../node/nx-devkit/index#taskgraph)
- [Tree](../../node/nx-devkit/index#tree)
- [Workspace](../../node/nx-devkit/index#workspace)
- [WorkspaceJsonConfiguration](../../node/nx-devkit/index#workspacejsonconfiguration)

### Type aliases

- [Executor](../../node/nx-devkit/index#executor)
- [Generator](../../node/nx-devkit/index#generator)
- [GeneratorCallback](../../node/nx-devkit/index#generatorcallback)
- [ImplicitDependencyEntry](../../node/nx-devkit/index#implicitdependencyentry)
- [PackageManager](../../node/nx-devkit/index#packagemanager)
- [ProjectType](../../node/nx-devkit/index#projecttype)
- [StringChange](../../node/nx-devkit/index#stringchange)
- [TaskGraphExecutor](../../node/nx-devkit/index#taskgraphexecutor)
- [WorkspaceConfiguration](../../node/nx-devkit/index#workspaceconfiguration)

### Variables

- [logger](../../node/nx-devkit/index#logger)

### Functions

- [addDependenciesToPackageJson](../../node/nx-devkit/index#adddependenciestopackagejson)
- [addProjectConfiguration](../../node/nx-devkit/index#addprojectconfiguration)
- [applyChangesToString](../../node/nx-devkit/index#applychangestostring)
- [convertNxExecutor](../../node/nx-devkit/index#convertnxexecutor)
- [convertNxGenerator](../../node/nx-devkit/index#convertnxgenerator)
- [detectPackageManager](../../node/nx-devkit/index#detectpackagemanager)
- [formatFiles](../../node/nx-devkit/index#formatfiles)
- [generateFiles](../../node/nx-devkit/index#generatefiles)
- [getPackageManagerCommand](../../node/nx-devkit/index#getpackagemanagercommand)
- [getPackageManagerVersion](../../node/nx-devkit/index#getpackagemanagerversion)
- [getProjects](../../node/nx-devkit/index#getprojects)
- [getWorkspaceLayout](../../node/nx-devkit/index#getworkspacelayout)
- [getWorkspacePath](../../node/nx-devkit/index#getworkspacepath)
- [installPackagesTask](../../node/nx-devkit/index#installpackagestask)
- [joinPathFragments](../../node/nx-devkit/index#joinpathfragments)
- [moveFilesToNewDirectory](../../node/nx-devkit/index#movefilestonewdirectory)
- [names](../../node/nx-devkit/index#names)
- [normalizePath](../../node/nx-devkit/index#normalizepath)
- [offsetFromRoot](../../node/nx-devkit/index#offsetfromroot)
- [parseJson](../../node/nx-devkit/index#parsejson)
- [parseTargetString](../../node/nx-devkit/index#parsetargetstring)
- [readJson](../../node/nx-devkit/index#readjson)
- [readJsonFile](../../node/nx-devkit/index#readjsonfile)
- [readProjectConfiguration](../../node/nx-devkit/index#readprojectconfiguration)
- [readTargetOptions](../../node/nx-devkit/index#readtargetoptions)
- [readWorkspaceConfiguration](../../node/nx-devkit/index#readworkspaceconfiguration)
- [removeDependenciesFromPackageJson](../../node/nx-devkit/index#removedependenciesfrompackagejson)
- [removeProjectConfiguration](../../node/nx-devkit/index#removeprojectconfiguration)
- [runExecutor](../../node/nx-devkit/index#runexecutor)
- [serializeJson](../../node/nx-devkit/index#serializejson)
- [stripIndents](../../node/nx-devkit/index#stripindents)
- [stripJsonComments](../../node/nx-devkit/index#stripjsoncomments)
- [targetToTargetString](../../node/nx-devkit/index#targettotargetstring)
- [toJS](../../node/nx-devkit/index#tojs)
- [updateJson](../../node/nx-devkit/index#updatejson)
- [updateProjectConfiguration](../../node/nx-devkit/index#updateprojectconfiguration)
- [updateTsConfigsToJs](../../node/nx-devkit/index#updatetsconfigstojs)
- [updateWorkspaceConfiguration](../../node/nx-devkit/index#updateworkspaceconfiguration)
- [visitNotIgnoredFiles](../../node/nx-devkit/index#visitnotignoredfiles)
- [writeJson](../../node/nx-devkit/index#writejson)
- [writeJsonFile](../../node/nx-devkit/index#writejsonfile)

## Enumerations

### ChangeType

• **ChangeType**: `Object`

---

### DependencyType

• **DependencyType**: `Object`

Type of dependency between projects

## Classes

### ProjectGraphBuilder

• **ProjectGraphBuilder**: `Object`

Builder for adding nodes and dependencies to a [ProjectGraph](../../node/nx-devkit/index#projectgraph)

## Interfaces

### ExecutorContext

• **ExecutorContext**: `Object`

Context that is passed into an executor

---

### FileChange

• **FileChange**: `Object`

Description of a file change in the Nx virtual file system/

---

### FileData

• **FileData**: `Object`

Some metadata about a file

---

### ImplicitJsonSubsetDependency

• **ImplicitJsonSubsetDependency**<`T`\>: `Object`

#### Type parameters

| Name | Type                |
| :--- | :------------------ |
| `T`  | `"*"` \| `string`[] |

---

### JsonParseOptions

• **JsonParseOptions**: `Object`

---

### JsonSerializeOptions

• **JsonSerializeOptions**: `Object`

---

### NxAffectedConfig

• **NxAffectedConfig**: `Object`

---

### NxJsonConfiguration

• **NxJsonConfiguration**<`T`\>: `Object`

Nx.json configuration

#### Type parameters

| Name | Type                |
| :--- | :------------------ |
| `T`  | `"*"` \| `string`[] |

---

### NxJsonProjectConfiguration

• **NxJsonProjectConfiguration**: `Object`

---

### NxPlugin

• **NxPlugin**: `Object`

A plugin for Nx

---

### ProjectConfiguration

• **ProjectConfiguration**: `Object`

Project configuration

---

### ProjectFileMap

• **ProjectFileMap**: `Object`

A list of files separated by the project they belong to

---

### ProjectGraph

• **ProjectGraph**<`T`\>: `Object`

A Graph of projects in the workspace and dependencies between them

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

---

### ProjectGraphDependency

• **ProjectGraphDependency**: `Object`

A dependency between two projects

---

### ProjectGraphNode

• **ProjectGraphNode**<`T`\>: `Object`

A node describing a project in a workspace

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

---

### ProjectGraphProcessorContext

• **ProjectGraphProcessorContext**: `Object`

Additional information to be used to process a project graph

---

### StringDeletion

• **StringDeletion**: `Object`

---

### StringInsertion

• **StringInsertion**: `Object`

---

### Target

• **Target**: `Object`

---

### TargetConfiguration

• **TargetConfiguration**: `Object`

Target's configuration

---

### TargetDependencyConfig

• **TargetDependencyConfig**: `Object`

---

### Task

• **Task**: `Object`

A representation of the invocation of an Executor

---

### TaskGraph

• **TaskGraph**: `Object`

Graph of Tasks to be executed

---

### Tree

• **Tree**: `Object`

Virtual file system tree.

---

### Workspace

• **Workspace**: `Object`

---

### WorkspaceJsonConfiguration

• **WorkspaceJsonConfiguration**: `Object`

Workspace configuration

## Type aliases

### Executor

Ƭ **Executor**<`T`\>: (`options`: `T`, `context`: [`ExecutorContext`](../../node/nx-devkit/index#executorcontext)) => `Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`options`, `context`): `Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

Implementation of a target of a project

##### Parameters

| Name      | Type                                                            |
| :-------- | :-------------------------------------------------------------- |
| `options` | `T`                                                             |
| `context` | [`ExecutorContext`](../../node/nx-devkit/index#executorcontext) |

##### Returns

`Promise`<`Object`\> \| `AsyncIterableIterator`<`Object`\>

---

### Generator

Ƭ **Generator**<`T`\>: (`tree`: `any`, `schema`: `T`) => `void` \| [`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback)\>

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |

#### Type declaration

▸ (`tree`, `schema`): `void` \| [`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback)\>

A function that schedules updates to the filesystem to be done atomically

##### Parameters

| Name     | Type  |
| :------- | :---- |
| `tree`   | `any` |
| `schema` | `T`   |

##### Returns

`void` \| [`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback) \| `Promise`<`void` \| [`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback)\>

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

▪ [key: `string`]: `T` \| [`ImplicitJsonSubsetDependency`](../../node/nx-devkit/index#implicitjsonsubsetdependency)<`T`\>

---

### PackageManager

Ƭ **PackageManager**: `"yarn"` \| `"pnpm"` \| `"npm"`

---

### ProjectType

Ƭ **ProjectType**: `"library"` \| `"application"`

Type of project supported

---

### StringChange

Ƭ **StringChange**: [`StringInsertion`](../../node/nx-devkit/index#stringinsertion) \| [`StringDeletion`](../../node/nx-devkit/index#stringdeletion)

A change to be made to a string

---

### TaskGraphExecutor

Ƭ **TaskGraphExecutor**<`T`\>: (`taskGraph`: [`TaskGraph`](../../node/nx-devkit/index#taskgraph), `options`: `Record`<`string`, `T`\>, `overrides`: `T`, `context`: [`ExecutorContext`](../../node/nx-devkit/index#executorcontext)) => `Promise`<`Record`<`string`, `Object`\>\>

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`taskGraph`, `options`, `overrides`, `context`): `Promise`<`Record`<`string`, `Object`\>\>

Implementation of a target of a project that handles multiple projects to be batched

##### Parameters

| Name        | Type                                                            |
| :---------- | :-------------------------------------------------------------- |
| `taskGraph` | [`TaskGraph`](../../node/nx-devkit/index#taskgraph)             |
| `options`   | `Record`<`string`, `T`\>                                        |
| `overrides` | `T`                                                             |
| `context`   | [`ExecutorContext`](../../node/nx-devkit/index#executorcontext) |

##### Returns

`Promise`<`Record`<`string`, `Object`\>\>

---

### WorkspaceConfiguration

Ƭ **WorkspaceConfiguration**: `Omit`<[`WorkspaceJsonConfiguration`](../../node/nx-devkit/index#workspacejsonconfiguration), `"projects"`\> & `Omit`<[`NxJsonConfiguration`](../../node/nx-devkit/index#nxjsonconfiguration), `"projects"`\>

## Variables

### logger

• `Const` **logger**: `Object`

#### Type declaration

| Name    | Type                        |
| :------ | :-------------------------- |
| `debug` | (...`s`: `any`[]) => `void` |
| `error` | (`s`: `any`) => `void`      |
| `fatal` | (...`s`: `any`[]) => `void` |
| `info`  | (`s`: `any`) => `void`      |
| `log`   | (...`s`: `any`[]) => `void` |
| `warn`  | (`s`: `any`) => `void`      |

## Functions

### addDependenciesToPackageJson

▸ **addDependenciesToPackageJson**(`host`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback)

Add Dependencies and Dev Dependencies to package.json

For example:

```typescript
addDependenciesToPackageJson(host, { react: 'latest' }, { jest: 'latest' });
```

This will **add** `react` and `jest` to the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name              | Type                                      | Default value    | Description                                                             |
| :---------------- | :---------------------------------------- | :--------------- | :---------------------------------------------------------------------- |
| `host`            | [`Tree`](../../node/nx-devkit/index#tree) | `undefined`      | Tree representing file system to modify                                 |
| `dependencies`    | `Record`<`string`, `string`\>             | `undefined`      | Dependencies to be added to the dependencies section of package.json    |
| `devDependencies` | `Record`<`string`, `string`\>             | `undefined`      | Dependencies to be added to the devDependencies section of package.json |
| `packageJsonPath` | `string`                                  | `'package.json'` | Path to package.json                                                    |

#### Returns

[`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback)

Callback to install dependencies only if necessary. undefined is returned if changes are not necessary.

---

### addProjectConfiguration

▸ **addProjectConfiguration**(`host`, `projectName`, `projectConfiguration`, `standalone?`): `void`

Adds project configuration to the Nx workspace.

The project configuration is stored in workspace.json and nx.json. The utility will update
both files.

#### Parameters

| Name                   | Type                                                                                                                                                              | Default value | Description                                                                                |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :----------------------------------------------------------------------------------------- |
| `host`                 | [`Tree`](../../node/nx-devkit/index#tree)                                                                                                                         | `undefined`   | the file system tree                                                                       |
| `projectName`          | `string`                                                                                                                                                          | `undefined`   | unique name. Often directories are part of the name (e.g., mydir-mylib)                    |
| `projectConfiguration` | [`ProjectConfiguration`](../../node/nx-devkit/index#projectconfiguration) & [`NxJsonProjectConfiguration`](../../node/nx-devkit/index#nxjsonprojectconfiguration) | `undefined`   | project configuration                                                                      |
| `standalone`           | `boolean`                                                                                                                                                         | `false`       | should the project use package.json? If false, the project config is inside workspace.json |

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

| Name      | Type                                                        |
| :-------- | :---------------------------------------------------------- |
| `text`    | `string`                                                    |
| `changes` | [`StringChange`](../../node/nx-devkit/index#stringchange)[] |

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
| `executor` | [`Executor`](../../node/nx-devkit/index#executor) |

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

| Name        | Type                                                      |
| :---------- | :-------------------------------------------------------- |
| `generator` | [`Generator`](../../node/nx-devkit/index#generator)<`T`\> |

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

### detectPackageManager

▸ **detectPackageManager**(`dir?`): [`PackageManager`](../../node/nx-devkit/index#packagemanager)

Detects which package manager is used in the workspace based on the lock file.

#### Parameters

| Name  | Type     | Default value |
| :---- | :------- | :------------ |
| `dir` | `string` | `''`          |

#### Returns

[`PackageManager`](../../node/nx-devkit/index#packagemanager)

---

### formatFiles

▸ **formatFiles**(`host`): `Promise`<`void`\>

Formats all the created or updated files using Prettier

#### Parameters

| Name   | Type                                      | Description          |
| :----- | :---------------------------------------- | :------------------- |
| `host` | [`Tree`](../../node/nx-devkit/index#tree) | the file system tree |

#### Returns

`Promise`<`void`\>

---

### generateFiles

▸ **generateFiles**(`host`, `srcFolder`, `target`, `substitutions`): `void`

Generates a folder of files based on provided templates.

While doing so it performs two substitutions:

- Substitutes segments of file names surrounded by \_\_
- Uses ejs to substitute values in templates

Examples:

```typescript
generateFiles(host, path.join(__dirname, 'files'), './tools/scripts', {
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

| Name            | Type                                      | Description                                   |
| :-------------- | :---------------------------------------- | :-------------------------------------------- |
| `host`          | [`Tree`](../../node/nx-devkit/index#tree) | the file system tree                          |
| `srcFolder`     | `string`                                  | the source folder of files (absolute path)    |
| `target`        | `string`                                  | the target folder (relative to the host root) |
| `substitutions` | `Object`                                  | an object of key-value pairs                  |

#### Returns

`void`

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

| Name             | Type                                                          |
| :--------------- | :------------------------------------------------------------ |
| `packageManager` | [`PackageManager`](../../node/nx-devkit/index#packagemanager) |

#### Returns

`PackageManagerCommands`

---

### getPackageManagerVersion

▸ **getPackageManagerVersion**(`packageManager?`): `string`

Returns the version of the package manager used in the workspace.
By default, the package manager is derived based on the lock file,
but it can also be passed in explicitly.

#### Parameters

| Name             | Type                                                          |
| :--------------- | :------------------------------------------------------------ |
| `packageManager` | [`PackageManager`](../../node/nx-devkit/index#packagemanager) |

#### Returns

`string`

---

### getProjects

▸ **getProjects**(`host`): `Map`<`string`, [`ProjectConfiguration`](../../node/nx-devkit/index#projectconfiguration) & [`NxJsonProjectConfiguration`](../../node/nx-devkit/index#nxjsonprojectconfiguration)\>

Get a map of all projects in a workspace.

Use [readProjectConfiguration](../../node/nx-devkit/index#readprojectconfiguration) if only one project is needed.

#### Parameters

| Name   | Type                                      |
| :----- | :---------------------------------------- |
| `host` | [`Tree`](../../node/nx-devkit/index#tree) |

#### Returns

`Map`<`string`, [`ProjectConfiguration`](../../node/nx-devkit/index#projectconfiguration) & [`NxJsonProjectConfiguration`](../../node/nx-devkit/index#nxjsonprojectconfiguration)\>

---

### getWorkspaceLayout

▸ **getWorkspaceLayout**(`host`): `Object`

Returns workspace defaults. It includes defaults folders for apps and libs,
and the default scope.

Example:

```typescript
{ appsDir: 'apps', libsDir: 'libs', npmScope: 'myorg' }
```

#### Parameters

| Name   | Type                                      | Description      |
| :----- | :---------------------------------------- | :--------------- |
| `host` | [`Tree`](../../node/nx-devkit/index#tree) | file system tree |

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

▸ **getWorkspacePath**(`host`): `string`

#### Parameters

| Name   | Type                                      |
| :----- | :---------------------------------------- |
| `host` | [`Tree`](../../node/nx-devkit/index#tree) |

#### Returns

`string`

---

### installPackagesTask

▸ **installPackagesTask**(`host`, `alwaysRun?`, `cwd?`, `packageManager?`): `void`

Runs `npm install` or `yarn install`. It will skip running the install if
`package.json` hasn't changed at all or it hasn't changed since the last invocation.

#### Parameters

| Name             | Type                                                          | Default value | Description                                                   |
| :--------------- | :------------------------------------------------------------ | :------------ | :------------------------------------------------------------ |
| `host`           | [`Tree`](../../node/nx-devkit/index#tree)                     | `undefined`   | the file system tree                                          |
| `alwaysRun`      | `boolean`                                                     | `false`       | always run the command even if `package.json` hasn't changed. |
| `cwd`            | `string`                                                      | `''`          | -                                                             |
| `packageManager` | [`PackageManager`](../../node/nx-devkit/index#packagemanager) | `undefined`   | -                                                             |

#### Returns

`void`

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

▸ **moveFilesToNewDirectory**(`host`, `oldDir`, `newDir`): `void`

#### Parameters

| Name     | Type                                      |
| :------- | :---------------------------------------- |
| `host`   | [`Tree`](../../node/nx-devkit/index#tree) |
| `oldDir` | `string`                                  |
| `newDir` | `string`                                  |

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

| Name | Type                    |
| :--- | :---------------------- |
| `T`  | extends ` object``any ` |

#### Parameters

| Name       | Type                                                              | Description            |
| :--------- | :---------------------------------------------------------------- | :--------------------- |
| `input`    | `string`                                                          | JSON content as string |
| `options?` | [`JsonParseOptions`](../../node/nx-devkit/index#jsonparseoptions) | JSON parse options     |

#### Returns

`T`

Object the JSON content represents

---

### parseTargetString

▸ **parseTargetString**(`targetString`): [`Target`](../../node/nx-devkit/index#target)

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

[`Target`](../../node/nx-devkit/index#target)

---

### readJson

▸ **readJson**<`T`\>(`host`, `path`, `options?`): `T`

Reads a document for host, removes all comments and parses JSON.

#### Type parameters

| Name | Type                    |
| :--- | :---------------------- |
| `T`  | extends ` object``any ` |

#### Parameters

| Name       | Type                                                              | Description                 |
| :--------- | :---------------------------------------------------------------- | :-------------------------- |
| `host`     | [`Tree`](../../node/nx-devkit/index#tree)                         | file system tree            |
| `path`     | `string`                                                          | file path                   |
| `options?` | [`JsonParseOptions`](../../node/nx-devkit/index#jsonparseoptions) | Optional JSON Parse Options |

#### Returns

`T`

---

### readJsonFile

▸ **readJsonFile**<`T`\>(`path`, `options?`): `T`

Reads a JSON file and returns the object the JSON content represents.

#### Type parameters

| Name | Type                    |
| :--- | :---------------------- |
| `T`  | extends ` object``any ` |

#### Parameters

| Name       | Type              | Description        |
| :--------- | :---------------- | :----------------- |
| `path`     | `string`          | A path to a file.  |
| `options?` | `JsonReadOptions` | JSON parse options |

#### Returns

`T`

Object the JSON content of the file represents

---

### readProjectConfiguration

▸ **readProjectConfiguration**(`host`, `projectName`): [`ProjectConfiguration`](../../node/nx-devkit/index#projectconfiguration) & [`NxJsonProjectConfiguration`](../../node/nx-devkit/index#nxjsonprojectconfiguration)

Reads a project configuration.

The project configuration is stored in workspace.json and nx.json. The utility will read
both files.

**`throws`** If supplied projectName cannot be found

#### Parameters

| Name          | Type                                      | Description                                                             |
| :------------ | :---------------------------------------- | :---------------------------------------------------------------------- |
| `host`        | [`Tree`](../../node/nx-devkit/index#tree) | the file system tree                                                    |
| `projectName` | `string`                                  | unique name. Often directories are part of the name (e.g., mydir-mylib) |

#### Returns

[`ProjectConfiguration`](../../node/nx-devkit/index#projectconfiguration) & [`NxJsonProjectConfiguration`](../../node/nx-devkit/index#nxjsonprojectconfiguration)

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

| Name                | Type                                                            |
| :------------------ | :-------------------------------------------------------------- |
| `__namedParameters` | [`Target`](../../node/nx-devkit/index#target)                   |
| `context`           | [`ExecutorContext`](../../node/nx-devkit/index#executorcontext) |

#### Returns

`T`

---

### readWorkspaceConfiguration

▸ **readWorkspaceConfiguration**(`host`): [`WorkspaceConfiguration`](../../node/nx-devkit/index#workspaceconfiguration)

Read general workspace configuration such as the default project or cli settings

This does _not_ provide projects configuration, use [readProjectConfiguration](../../node/nx-devkit/index#readprojectconfiguration) instead.

#### Parameters

| Name   | Type                                      |
| :----- | :---------------------------------------- |
| `host` | [`Tree`](../../node/nx-devkit/index#tree) |

#### Returns

[`WorkspaceConfiguration`](../../node/nx-devkit/index#workspaceconfiguration)

---

### removeDependenciesFromPackageJson

▸ **removeDependenciesFromPackageJson**(`host`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback)

Remove Dependencies and Dev Dependencies from package.json

For example:

```typescript
removeDependenciesFromPackageJson(host, ['react'], ['jest']);
```

This will **remove** `react` and `jest` from the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name              | Type                                      | Default value    | Description                                                                 |
| :---------------- | :---------------------------------------- | :--------------- | :-------------------------------------------------------------------------- |
| `host`            | [`Tree`](../../node/nx-devkit/index#tree) | `undefined`      | -                                                                           |
| `dependencies`    | `string`[]                                | `undefined`      | Dependencies to be removed from the dependencies section of package.json    |
| `devDependencies` | `string`[]                                | `undefined`      | Dependencies to be removed from the devDependencies section of package.json |
| `packageJsonPath` | `string`                                  | `'package.json'` | -                                                                           |

#### Returns

[`GeneratorCallback`](../../node/nx-devkit/index#generatorcallback)

Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.

---

### removeProjectConfiguration

▸ **removeProjectConfiguration**(`host`, `projectName`): `void`

Removes the configuration of an existing project.

The project configuration is stored in workspace.json and nx.json.
The utility will update both files.

#### Parameters

| Name          | Type                                      |
| :------------ | :---------------------------------------- |
| `host`        | [`Tree`](../../node/nx-devkit/index#tree) |
| `projectName` | `string`                                  |

#### Returns

`void`

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

| Name                               | Type                                                            |
| :--------------------------------- | :-------------------------------------------------------------- |
| `targetDescription`                | `Object`                                                        |
| `targetDescription.configuration?` | `string`                                                        |
| `targetDescription.project`        | `string`                                                        |
| `targetDescription.target`         | `string`                                                        |
| `options`                          | `Object`                                                        |
| `context`                          | [`ExecutorContext`](../../node/nx-devkit/index#executorcontext) |

#### Returns

`Promise`<`AsyncIterableIterator`<`T`\>\>

---

### serializeJson

▸ **serializeJson**<`T`\>(`input`, `options?`): `string`

Serializes the given data to a JSON string.
By default the JSON string is formatted with a 2 space intendation to be easy readable.

#### Type parameters

| Name | Type                       |
| :--- | :------------------------- |
| `T`  | extends ` object``object ` |

#### Parameters

| Name       | Type                                                                      | Description                               |
| :--------- | :------------------------------------------------------------------------ | :---------------------------------------- |
| `input`    | `T`                                                                       | Object which should be serialized to JSON |
| `options?` | [`JsonSerializeOptions`](../../node/nx-devkit/index#jsonserializeoptions) | JSON serialize options                    |

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

▸ **targetToTargetString**(`__namedParameters`): `string`

Returns a string in the format "project:target[:configuration]" for the target

#### Parameters

| Name                | Type                                          |
| :------------------ | :-------------------------------------------- |
| `__namedParameters` | [`Target`](../../node/nx-devkit/index#target) |

#### Returns

`string`

---

### toJS

▸ **toJS**(`tree`): `void`

Rename and transpile any new typescript files created to javascript files

#### Parameters

| Name   | Type                                      |
| :----- | :---------------------------------------- |
| `tree` | [`Tree`](../../node/nx-devkit/index#tree) |

#### Returns

`void`

---

### updateJson

▸ **updateJson**<`T`, `U`\>(`host`, `path`, `updater`, `options?`): `void`

Updates a JSON value to the file system tree

#### Type parameters

| Name | Type                    |
| :--- | :---------------------- |
| `T`  | extends ` object``any ` |
| `U`  | extends ` object``T `   |

#### Parameters

| Name       | Type                                                                                                                                          | Description                                                                                          |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `host`     | [`Tree`](../../node/nx-devkit/index#tree)                                                                                                     | File system tree                                                                                     |
| `path`     | `string`                                                                                                                                      | Path of JSON file in the Tree                                                                        |
| `updater`  | (`value`: `T`) => `U`                                                                                                                         | Function that maps the current value of a JSON document to a new value to be written to the document |
| `options?` | [`JsonParseOptions`](../../node/nx-devkit/index#jsonparseoptions) & [`JsonSerializeOptions`](../../node/nx-devkit/index#jsonserializeoptions) | Optional JSON Parse and Serialize Options                                                            |

#### Returns

`void`

---

### updateProjectConfiguration

▸ **updateProjectConfiguration**(`host`, `projectName`, `projectConfiguration`): `void`

Updates the configuration of an existing project.

The project configuration is stored in workspace.json and nx.json. The utility will update
both files.

#### Parameters

| Name                   | Type                                                                                                                                                              | Description                                                             |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `host`                 | [`Tree`](../../node/nx-devkit/index#tree)                                                                                                                         | the file system tree                                                    |
| `projectName`          | `string`                                                                                                                                                          | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [`ProjectConfiguration`](../../node/nx-devkit/index#projectconfiguration) & [`NxJsonProjectConfiguration`](../../node/nx-devkit/index#nxjsonprojectconfiguration) | project configuration                                                   |

#### Returns

`void`

---

### updateTsConfigsToJs

▸ **updateTsConfigsToJs**(`host`, `options`): `void`

#### Parameters

| Name                  | Type                                      |
| :-------------------- | :---------------------------------------- |
| `host`                | [`Tree`](../../node/nx-devkit/index#tree) |
| `options`             | `Object`                                  |
| `options.projectRoot` | `string`                                  |

#### Returns

`void`

---

### updateWorkspaceConfiguration

▸ **updateWorkspaceConfiguration**(`host`, `workspaceConfig`): `void`

Update general workspace configuration such as the default project or cli settings.

This does _not_ update projects configuration, use [updateProjectConfiguration](../../node/nx-devkit/index#updateprojectconfiguration) or [addProjectConfiguration](../../node/nx-devkit/index#addprojectconfiguration) instead.

#### Parameters

| Name              | Type                                                                          |
| :---------------- | :---------------------------------------------------------------------------- |
| `host`            | [`Tree`](../../node/nx-devkit/index#tree)                                     |
| `workspaceConfig` | [`WorkspaceConfiguration`](../../node/nx-devkit/index#workspaceconfiguration) |

#### Returns

`void`

---

### visitNotIgnoredFiles

▸ **visitNotIgnoredFiles**(`tree`, `dirPath?`, `visitor`): `void`

Utility to act on all files in a tree that are not ignored by git.

#### Parameters

| Name      | Type                                      |
| :-------- | :---------------------------------------- |
| `tree`    | [`Tree`](../../node/nx-devkit/index#tree) |
| `dirPath` | `string`                                  |
| `visitor` | (`path`: `string`) => `void`              |

#### Returns

`void`

---

### writeJson

▸ **writeJson**<`T`\>(`host`, `path`, `value`, `options?`): `void`

Writes a JSON value to the file system tree

#### Type parameters

| Name | Type                       |
| :--- | :------------------------- |
| `T`  | extends ` object``object ` |

#### Parameters

| Name       | Type                                                                      | Description                     |
| :--------- | :------------------------------------------------------------------------ | :------------------------------ |
| `host`     | [`Tree`](../../node/nx-devkit/index#tree)                                 | File system tree                |
| `path`     | `string`                                                                  | Path of JSON file in the Tree   |
| `value`    | `T`                                                                       | Serializable value to write     |
| `options?` | [`JsonSerializeOptions`](../../node/nx-devkit/index#jsonserializeoptions) | Optional JSON Serialize Options |

#### Returns

`void`

---

### writeJsonFile

▸ **writeJsonFile**<`T`\>(`path`, `data`, `options?`): `void`

Serializes the given data to JSON and writes it to a file.

#### Type parameters

| Name | Type                       |
| :--- | :------------------------- |
| `T`  | extends ` object``object ` |

#### Parameters

| Name       | Type               | Description                                                     |
| :--------- | :----------------- | :-------------------------------------------------------------- |
| `path`     | `string`           | A path to a file.                                               |
| `data`     | `T`                | data which should be serialized to JSON and written to the file |
| `options?` | `JsonWriteOptions` | JSON serialize options                                          |

#### Returns

`void`
