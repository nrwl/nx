# Module: index

## Table of contents

### Enumerations

- [ChangeType](/latest/node/nx-devkit/index#changetype)
- [DependencyType](/latest/node/nx-devkit/index#dependencytype)

### Classes

- [ProjectGraphBuilder](/latest/node/nx-devkit/index#projectgraphbuilder)

### Interfaces

- [ExecutorContext](/latest/node/nx-devkit/index#executorcontext)
- [FileChange](/latest/node/nx-devkit/index#filechange)
- [FileData](/latest/node/nx-devkit/index#filedata)
- [ImplicitJsonSubsetDependency](/latest/node/nx-devkit/index#implicitjsonsubsetdependency)
- [NxAffectedConfig](/latest/node/nx-devkit/index#nxaffectedconfig)
- [NxJsonConfiguration](/latest/node/nx-devkit/index#nxjsonconfiguration)
- [NxJsonProjectConfiguration](/latest/node/nx-devkit/index#nxjsonprojectconfiguration)
- [NxPlugin](/latest/node/nx-devkit/index#nxplugin)
- [ProjectConfiguration](/latest/node/nx-devkit/index#projectconfiguration)
- [ProjectFileMap](/latest/node/nx-devkit/index#projectfilemap)
- [ProjectGraph](/latest/node/nx-devkit/index#projectgraph)
- [ProjectGraphDependency](/latest/node/nx-devkit/index#projectgraphdependency)
- [ProjectGraphNode](/latest/node/nx-devkit/index#projectgraphnode)
- [ProjectGraphProcessorContext](/latest/node/nx-devkit/index#projectgraphprocessorcontext)
- [StringDeletion](/latest/node/nx-devkit/index#stringdeletion)
- [StringInsertion](/latest/node/nx-devkit/index#stringinsertion)
- [Target](/latest/node/nx-devkit/index#target)
- [TargetConfiguration](/latest/node/nx-devkit/index#targetconfiguration)
- [TargetDependencyConfig](/latest/node/nx-devkit/index#targetdependencyconfig)
- [Tree](/latest/node/nx-devkit/index#tree)
- [Workspace](/latest/node/nx-devkit/index#workspace)
- [WorkspaceJsonConfiguration](/latest/node/nx-devkit/index#workspacejsonconfiguration)

### Type aliases

- [Executor](/latest/node/nx-devkit/index#executor)
- [Generator](/latest/node/nx-devkit/index#generator)
- [GeneratorCallback](/latest/node/nx-devkit/index#generatorcallback)
- [ImplicitDependencyEntry](/latest/node/nx-devkit/index#implicitdependencyentry)
- [PackageManager](/latest/node/nx-devkit/index#packagemanager)
- [ProjectType](/latest/node/nx-devkit/index#projecttype)
- [StringChange](/latest/node/nx-devkit/index#stringchange)
- [WorkspaceConfiguration](/latest/node/nx-devkit/index#workspaceconfiguration)

### Variables

- [logger](/latest/node/nx-devkit/index#logger)

### Functions

- [addDependenciesToPackageJson](/latest/node/nx-devkit/index#adddependenciestopackagejson)
- [addProjectConfiguration](/latest/node/nx-devkit/index#addprojectconfiguration)
- [applyChangesToString](/latest/node/nx-devkit/index#applychangestostring)
- [convertNxExecutor](/latest/node/nx-devkit/index#convertnxexecutor)
- [convertNxGenerator](/latest/node/nx-devkit/index#convertnxgenerator)
- [formatFiles](/latest/node/nx-devkit/index#formatfiles)
- [generateFiles](/latest/node/nx-devkit/index#generatefiles)
- [getPackageManagerCommand](/latest/node/nx-devkit/index#getpackagemanagercommand)
- [getProjects](/latest/node/nx-devkit/index#getprojects)
- [getWorkspaceLayout](/latest/node/nx-devkit/index#getworkspacelayout)
- [getWorkspacePath](/latest/node/nx-devkit/index#getworkspacepath)
- [installPackagesTask](/latest/node/nx-devkit/index#installpackagestask)
- [joinPathFragments](/latest/node/nx-devkit/index#joinpathfragments)
- [names](/latest/node/nx-devkit/index#names)
- [normalizePath](/latest/node/nx-devkit/index#normalizepath)
- [offsetFromRoot](/latest/node/nx-devkit/index#offsetfromroot)
- [parseTargetString](/latest/node/nx-devkit/index#parsetargetstring)
- [readJson](/latest/node/nx-devkit/index#readjson)
- [readProjectConfiguration](/latest/node/nx-devkit/index#readprojectconfiguration)
- [readTargetOptions](/latest/node/nx-devkit/index#readtargetoptions)
- [readWorkspaceConfiguration](/latest/node/nx-devkit/index#readworkspaceconfiguration)
- [removeDependenciesFromPackageJson](/latest/node/nx-devkit/index#removedependenciesfrompackagejson)
- [removeProjectConfiguration](/latest/node/nx-devkit/index#removeprojectconfiguration)
- [runExecutor](/latest/node/nx-devkit/index#runexecutor)
- [stripIndents](/latest/node/nx-devkit/index#stripindents)
- [targetToTargetString](/latest/node/nx-devkit/index#targettotargetstring)
- [toJS](/latest/node/nx-devkit/index#tojs)
- [updateJson](/latest/node/nx-devkit/index#updatejson)
- [updateProjectConfiguration](/latest/node/nx-devkit/index#updateprojectconfiguration)
- [updateTsConfigsToJs](/latest/node/nx-devkit/index#updatetsconfigstojs)
- [updateWorkspaceConfiguration](/latest/node/nx-devkit/index#updateworkspaceconfiguration)
- [visitNotIgnoredFiles](/latest/node/nx-devkit/index#visitnotignoredfiles)
- [writeJson](/latest/node/nx-devkit/index#writejson)

## Enumerations

### ChangeType

• **ChangeType**: *object*

___

### DependencyType

• **DependencyType**: *object*

Type of dependency between projects

## Classes

### ProjectGraphBuilder

• **ProjectGraphBuilder**: *object*

Builder for adding nodes and dependencies to a [ProjectGraph](/latest/node/nx-devkit/index#projectgraph)

## Interfaces

### ExecutorContext

• **ExecutorContext**: *object*

Context that is passed into an executor

___

### FileChange

• **FileChange**: *object*

Description of a file change in the Nx virtual file system/

___

### FileData

• **FileData**: *object*

Some metadata about a file

___

### ImplicitJsonSubsetDependency

• **ImplicitJsonSubsetDependency**<T\>: *object*

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | ``"*"`` \| *string*[] |

___

### NxAffectedConfig

• **NxAffectedConfig**: *object*

___

### NxJsonConfiguration

• **NxJsonConfiguration**<T\>: *object*

Nx.json configuration

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | ``"*"`` \| *string*[] |

___

### NxJsonProjectConfiguration

• **NxJsonProjectConfiguration**: *object*

___

### NxPlugin

• **NxPlugin**: *object*

A plugin for Nx

___

### ProjectConfiguration

• **ProjectConfiguration**: *object*

Project configuration

___

### ProjectFileMap

• **ProjectFileMap**: *object*

A list of files separated by the project they belong to

___

### ProjectGraph

• **ProjectGraph**<T\>: *object*

A Graph of projects in the workspace and dependencies between them

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

___

### ProjectGraphDependency

• **ProjectGraphDependency**: *object*

A dependency between two projects

___

### ProjectGraphNode

• **ProjectGraphNode**<T\>: *object*

A node describing a project in a workspace

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

___

### ProjectGraphProcessorContext

• **ProjectGraphProcessorContext**: *object*

Additional information to be used to process a project graph

___

### StringDeletion

• **StringDeletion**: *object*

___

### StringInsertion

• **StringInsertion**: *object*

___

### Target

• **Target**: *object*

___

### TargetConfiguration

• **TargetConfiguration**: *object*

Target's configuration

___

### TargetDependencyConfig

• **TargetDependencyConfig**: *object*

___

### Tree

• **Tree**: *object*

Virtual file system tree.

___

### Workspace

• **Workspace**: *object*

___

### WorkspaceJsonConfiguration

• **WorkspaceJsonConfiguration**: *object*

Workspace configuration

## Type aliases

### Executor

Ƭ **Executor**<T\>: (`options`: T, `context`: [*ExecutorContext*](/latest/node/nx-devkit/index#executorcontext)) => *Promise*<{ `success`: *boolean*  }\> \| *AsyncIterableIterator*<{ `success`: *boolean*  }\>

Implementation of a target of a project

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Type declaration

▸ (`options`: T, `context`: [*ExecutorContext*](/latest/node/nx-devkit/index#executorcontext)): *Promise*<{ `success`: *boolean*  }\> \| *AsyncIterableIterator*<{ `success`: *boolean*  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | T |
| `context` | [*ExecutorContext*](/latest/node/nx-devkit/index#executorcontext) |

**Returns:** *Promise*<{ `success`: *boolean*  }\> \| *AsyncIterableIterator*<{ `success`: *boolean*  }\>

___

### Generator

Ƭ **Generator**<T\>: (`tree`: *any*, `schema`: T) => *void* \| [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback) \| *Promise*<void \| [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback)\>

A function that schedules updates to the filesystem to be done atomically

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *unknown* |

#### Type declaration

▸ (`tree`: *any*, `schema`: T): *void* \| [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback) \| *Promise*<void \| [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `tree` | *any* |
| `schema` | T |

**Returns:** *void* \| [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback) \| *Promise*<void \| [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback)\>

___

### GeneratorCallback

Ƭ **GeneratorCallback**: () => *void* \| *Promise*<void\>

A callback function that is executed after changes are made to the file system

#### Type declaration

▸ (): *void* \| *Promise*<void\>

**Returns:** *void* \| *Promise*<void\>

___

### ImplicitDependencyEntry

Ƭ **ImplicitDependencyEntry**<T\>: *object*

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | ``"*"`` \| *string*[] |

#### Type declaration

___

### PackageManager

Ƭ **PackageManager**: ``"yarn"`` \| ``"pnpm"`` \| ``"npm"``

___

### ProjectType

Ƭ **ProjectType**: ``"library"`` \| ``"application"``

Type of project supported

___

### StringChange

Ƭ **StringChange**: [*StringInsertion*](/latest/node/nx-devkit/index#stringinsertion) \| [*StringDeletion*](/latest/node/nx-devkit/index#stringdeletion)

A change to be made to a string

___

### WorkspaceConfiguration

Ƭ **WorkspaceConfiguration**: *Omit*<[*WorkspaceJsonConfiguration*](/latest/node/nx-devkit/index#workspacejsonconfiguration), ``"projects"``\> & *Omit*<[*NxJsonConfiguration*](/latest/node/nx-devkit/index#nxjsonconfiguration), ``"projects"``\>

## Variables

### logger

• `Const` **logger**: *object*

#### Type declaration

| Name | Type |
| :------ | :------ |
| `debug` | (...`s`: *any*[]) => *void* |
| `error` | (`s`: *any*) => *void* |
| `fatal` | (...`s`: *any*[]) => *void* |
| `info` | (`s`: *any*) => *void* |
| `log` | (...`s`: *any*[]) => *void* |
| `warn` | (`s`: *any*) => *void* |

## Functions

### addDependenciesToPackageJson

▸ **addDependenciesToPackageJson**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `dependencies`: *Record*<string, string\>, `devDependencies`: *Record*<string, string\>, `packageJsonPath?`: *string*): [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback)

Add Dependencies and Dev Dependencies to package.json

For example, `addDependenciesToPackageJson(host, { react: 'latest' }, { jest: 'latest' })`
will add `react` and `jest` to the dependencies and devDependencies sections of package.json respectively

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | - | Tree representing file system to modify |
| `dependencies` | *Record*<string, string\> | - | Dependencies to be added to the dependencies section of package.json |
| `devDependencies` | *Record*<string, string\> | - | Dependencies to be added to the devDependencies section of package.json |
| `packageJsonPath` | *string* | 'package.json' | Path to package.json |

**Returns:** [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback)

Callback to install dependencies only if necessary. undefined is returned if changes are not necessary.

___

### addProjectConfiguration

▸ **addProjectConfiguration**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `projectName`: *string*, `projectConfiguration`: [*ProjectConfiguration*](/latest/node/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/node/nx-devkit/index#nxjsonprojectconfiguration)): *void*

Adds project configuration to the Nx workspace.

The project configuration is stored in workspace.json and nx.json. The utility will update
both files.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | the file system tree |
| `projectName` | *string* | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [*ProjectConfiguration*](/latest/node/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/node/nx-devkit/index#nxjsonprojectconfiguration) | project configuration |

**Returns:** *void*

___

### applyChangesToString

▸ **applyChangesToString**(`text`: *string*, `changes`: [*StringChange*](/latest/node/nx-devkit/index#stringchange)[]): *string*

Applies a list of changes to a string's original value.

This is useful when working with ASTs.

For Example, to rename a property in a method's options:

```
const code = `bootstrap({
  target: document.querySelector('#app')
})`;

const indexOfPropertyName = 13; // Usually determined by analyzing an AST.
const updatedCode = applyChangesToString(code, [
  {
    type: ChangeType.Insert,
    index: indexOfPropertyName,
    text: 'element'
  },
  {
    type: ChangeType.Delete,
    start: indexOfPropertyName,
    length: 6
  },
]);

bootstrap({
  element: document.querySelector('#app')
});
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `text` | *string* |
| `changes` | [*StringChange*](/latest/node/nx-devkit/index#stringchange)[] |

**Returns:** *string*

___

### convertNxExecutor

▸ **convertNxExecutor**(`executor`: [*Executor*](/latest/node/nx-devkit/index#executor)): *any*

Convert an Nx Executor into an Angular Devkit Builder

Use this to expose a compatible Angular Builder

#### Parameters

| Name | Type |
| :------ | :------ |
| `executor` | [*Executor*](/latest/node/nx-devkit/index#executor) |

**Returns:** *any*

___

### convertNxGenerator

▸ **convertNxGenerator**<T\>(`generator`: [*Generator*](/latest/node/nx-devkit/index#generator)<T\>): *function*

Convert an Nx Generator into an Angular Devkit Schematic

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Parameters

| Name | Type |
| :------ | :------ |
| `generator` | [*Generator*](/latest/node/nx-devkit/index#generator)<T\> |

**Returns:** (`options`: T) => (`tree`: *any*, `context`: *any*) => *Promise*<any\>

___

### formatFiles

▸ **formatFiles**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree)): *Promise*<void\>

Formats all the created or updated files using Prettier

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | the file system tree |

**Returns:** *Promise*<void\>

___

### generateFiles

▸ **generateFiles**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `srcFolder`: *string*, `target`: *string*, `substitutions`: { [k: string]: *any*;  }): *void*

Generates a folder of files based on provided templates.

While doing so it performs two substitutions:
- Substitutes segments of file names surrounded by __
- Uses ejs to substitute values in templates

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | the file system tree |
| `srcFolder` | *string* | the source folder of files (absolute path) |
| `target` | *string* | the target folder (relative to the host root) |
| `substitutions` | *object* | an object of key-value pairs  Examples:  ```typescript generateFiles(host, path.join(__dirname , 'files'), './tools/scripts', {tmpl: '', name: 'myscript'}) ```  This command will take all the files from the `files` directory next to the place where the command is invoked from. It will replace all `__tmpl__` with '' and all `__name__` with 'myscript' in the file names, and will replace all `<%= name %>` with `myscript` in the files themselves.  `tmpl: ''` is a common pattern. With it you can name files like this: `index.ts__tmpl__`, so your editor doesn't get confused about incorrect TypeScript files. |

**Returns:** *void*

___

### getPackageManagerCommand

▸ **getPackageManagerCommand**(`packageManager?`: [*PackageManager*](/latest/node/nx-devkit/index#packagemanager)): *object*

Returns commands for the package manager used in the workspace.
By default, the package manager is derived based on the lock file,
but it can also be passed in explicitly.

Example:

```javascript
execSync(`${getPackageManagerCommand().addDev} my-dev-package`);
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `packageManager` | [*PackageManager*](/latest/node/nx-devkit/index#packagemanager) |

**Returns:** *object*

| Name | Type |
| :------ | :------ |
| `add` | *string* |
| `addDev` | *string* |
| `exec` | *string* |
| `install` | *string* |
| `list` | *string* |
| `rm` | *string* |
| `run` | (`script`: *string*, `args`: *string*) => *string* |

___

### getProjects

▸ **getProjects**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree)): *Map*<string, [*ProjectConfiguration*](/latest/node/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/node/nx-devkit/index#nxjsonprojectconfiguration)\>

Get a map of all projects in a workspace.

Use [readProjectConfiguration](/latest/node/nx-devkit/index#readprojectconfiguration) if only one project is needed.

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) |

**Returns:** *Map*<string, [*ProjectConfiguration*](/latest/node/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/node/nx-devkit/index#nxjsonprojectconfiguration)\>

___

### getWorkspaceLayout

▸ **getWorkspaceLayout**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree)): *object*

Returns workspace defaults. It includes defaults folders for apps and libs,
and the default scope.

Example:

`{ appsDir: 'apps', libsDir: 'libs', npmScope: 'myorg' }`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | file system tree |

**Returns:** *object*

| Name | Type |
| :------ | :------ |
| `appsDir` | *string* |
| `libsDir` | *string* |
| `npmScope` | *string* |

___

### getWorkspacePath

▸ **getWorkspacePath**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree)): *string*

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) |

**Returns:** *string*

___

### installPackagesTask

▸ **installPackagesTask**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `alwaysRun?`: *boolean*, `cwd?`: *string*, `packageManager?`: [*PackageManager*](/latest/node/nx-devkit/index#packagemanager)): *void*

Runs `npm install` or `yarn install`. It will skip running the install if
`package.json` hasn't changed at all or it hasn't changed since the last invocation.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | - | the file system tree |
| `alwaysRun` | *boolean* | false | always run the command even if `package.json` hasn't changed. |
| `cwd` | *string* | '' | - |
| `packageManager` | [*PackageManager*](/latest/node/nx-devkit/index#packagemanager) | - | - |

**Returns:** *void*

___

### joinPathFragments

▸ **joinPathFragments**(...`fragments`: *string*[]): *string*

Normalized path fragments and joins them

#### Parameters

| Name | Type |
| :------ | :------ |
| `...fragments` | *string*[] |

**Returns:** *string*

___

### names

▸ **names**(`name`: *string*): *object*

Util function to generate different strings based off the provided name.

Examples:

```typescript
names("my-name") // {name: 'my-name', className: 'MyName', propertyName: 'myName', constantName: 'MY_NAME', fileName: 'my-name'}
names("myName") // {name: 'my-name', className: 'MyName', propertyName: 'myName', constantName: 'MY_NAME', fileName: 'my-name'}
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | *string* |

**Returns:** *object*

| Name | Type |
| :------ | :------ |
| `className` | *string* |
| `constantName` | *string* |
| `fileName` | *string* |
| `name` | *string* |
| `propertyName` | *string* |

___

### normalizePath

▸ **normalizePath**(`osSpecificPath`: *string*): *string*

Coverts an os specific path to a unix style path

#### Parameters

| Name | Type |
| :------ | :------ |
| `osSpecificPath` | *string* |

**Returns:** *string*

___

### offsetFromRoot

▸ **offsetFromRoot**(`fullPathToDir`: *string*): *string*

Calculates an offset from the root of the workspace, which is useful for
constructing relative URLs.

Examples:

```typescript
offsetFromRoot("apps/mydir/myapp/") // returns "../../../"
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `fullPathToDir` | *string* | directory path |

**Returns:** *string*

___

### parseTargetString

▸ **parseTargetString**(`targetString`: *string*): [*Target*](/latest/node/nx-devkit/index#target)

Parses a target string into {project, target, configuration}

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `targetString` | *string* | target reference  Examples:  ```typescript parseTargetString("proj:test") // returns { project: "proj", target: "test" } parseTargetString("proj:test:production") // returns { project: "proj", target: "test", configuration: "production" } ``` |

**Returns:** [*Target*](/latest/node/nx-devkit/index#target)

___

### readJson

▸ **readJson**<T\>(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `path`: *string*): T

Reads a document for host, removes all comments and parses JSON.

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | file system tree |
| `path` | *string* | file path |

**Returns:** T

___

### readProjectConfiguration

▸ **readProjectConfiguration**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `projectName`: *string*): [*ProjectConfiguration*](/latest/node/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/node/nx-devkit/index#nxjsonprojectconfiguration)

Reads a project configuration.

The project configuration is stored in workspace.json and nx.json. The utility will read
both files.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | the file system tree |
| `projectName` | *string* | unique name. Often directories are part of the name (e.g., mydir-mylib) |

**Returns:** [*ProjectConfiguration*](/latest/node/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/node/nx-devkit/index#nxjsonprojectconfiguration)

___

### readTargetOptions

▸ **readTargetOptions**<T\>(`__namedParameters`: [*Target*](/latest/node/nx-devkit/index#target), `context`: [*ExecutorContext*](/latest/node/nx-devkit/index#executorcontext)): T

Reads and combines options for a given target.

Works as if you invoked the target yourself without passing any command lint overrides.

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | [*Target*](/latest/node/nx-devkit/index#target) |
| `context` | [*ExecutorContext*](/latest/node/nx-devkit/index#executorcontext) |

**Returns:** T

___

### readWorkspaceConfiguration

▸ **readWorkspaceConfiguration**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree)): [*WorkspaceConfiguration*](/latest/node/nx-devkit/index#workspaceconfiguration)

Read general workspace configuration such as the default project or cli settings

This does _not_ provide projects configuration, use [readProjectConfiguration](/latest/node/nx-devkit/index#readprojectconfiguration) instead.

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) |

**Returns:** [*WorkspaceConfiguration*](/latest/node/nx-devkit/index#workspaceconfiguration)

___

### removeDependenciesFromPackageJson

▸ **removeDependenciesFromPackageJson**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `dependencies`: *string*[], `devDependencies`: *string*[], `packageJsonPath?`: *string*): [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback)

Remove Dependencies and Dev Dependencies from package.json

For example, `removeDependenciesFromPackageJson(host, ['react'], ['jest'])`
will remove `react` and `jest` from the dependencies and devDependencies sections of package.json respectively

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | - | - |
| `dependencies` | *string*[] | - | Dependencies to be removed from the dependencies section of package.json |
| `devDependencies` | *string*[] | - | Dependencies to be removed from the devDependencies section of package.json |
| `packageJsonPath` | *string* | 'package.json' | - |

**Returns:** [*GeneratorCallback*](/latest/node/nx-devkit/index#generatorcallback)

Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.

___

### removeProjectConfiguration

▸ **removeProjectConfiguration**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `projectName`: *string*): *void*

Removes the configuration of an existing project.

The project configuration is stored in workspace.json and nx.json.
The utility will update both files.

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) |
| `projectName` | *string* |

**Returns:** *void*

___

### runExecutor

▸ **runExecutor**<T\>(`targetDescription`: { `configuration?`: *string* ; `project`: *string* ; `target`: *string*  }, `options`: { [k: string]: *any*;  }, `context`: [*ExecutorContext*](/latest/node/nx-devkit/index#executorcontext)): *Promise*<AsyncIterableIterator<T\>\>

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
for await (const s of await runExecutor({project: 'myproj', target: 'serve'}, {watch: true}, context)) {
  // s.success
}
```

Note that the return value is a promise of an iterator, so you need to await before iterating over it.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | *object* |
| `T.success` | *boolean* |

#### Parameters

| Name | Type |
| :------ | :------ |
| `targetDescription` | *object* |
| `targetDescription.configuration?` | *string* |
| `targetDescription.project` | *string* |
| `targetDescription.target` | *string* |
| `options` | *object* |
| `context` | [*ExecutorContext*](/latest/node/nx-devkit/index#executorcontext) |

**Returns:** *Promise*<AsyncIterableIterator<T\>\>

___

### stripIndents

▸ **stripIndents**(`strings`: TemplateStringsArray, ...`values`: *any*[]): *string*

Removes indents, which is useful for printing warning and messages.

Example:

```typescript
stripIndents`
 Options:
 - option1
 - option2
`
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `strings` | TemplateStringsArray |
| `...values` | *any*[] |

**Returns:** *string*

___

### targetToTargetString

▸ **targetToTargetString**(`__namedParameters`: [*Target*](/latest/node/nx-devkit/index#target)): *string*

Returns a string in the format "project:target[:configuration]" for the target

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | [*Target*](/latest/node/nx-devkit/index#target) |

**Returns:** *string*

___

### toJS

▸ **toJS**(`tree`: [*Tree*](/latest/node/nx-devkit/index#tree)): *void*

Rename and transpile any new typescript files created to javascript files

#### Parameters

| Name | Type |
| :------ | :------ |
| `tree` | [*Tree*](/latest/node/nx-devkit/index#tree) |

**Returns:** *void*

___

### updateJson

▸ **updateJson**<T, U\>(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `path`: *string*, `updater`: (`value`: T) => U): *void*

Updates a JSON value to the file system tree

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |
| `U` | T |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | File system tree |
| `path` | *string* | Path of JSON file in the Tree |
| `updater` | (`value`: T) => U | Function that maps the current value of a JSON document to a new value to be written to the document |

**Returns:** *void*

___

### updateProjectConfiguration

▸ **updateProjectConfiguration**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `projectName`: *string*, `projectConfiguration`: [*ProjectConfiguration*](/latest/node/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/node/nx-devkit/index#nxjsonprojectconfiguration)): *void*

Updates the configuration of an existing project.

The project configuration is stored in workspace.json and nx.json. The utility will update
both files.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | the file system tree |
| `projectName` | *string* | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [*ProjectConfiguration*](/latest/node/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/node/nx-devkit/index#nxjsonprojectconfiguration) | project configuration |

**Returns:** *void*

___

### updateTsConfigsToJs

▸ **updateTsConfigsToJs**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `options`: { `projectRoot`: *string*  }): *void*

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) |
| `options` | *object* |
| `options.projectRoot` | *string* |

**Returns:** *void*

___

### updateWorkspaceConfiguration

▸ **updateWorkspaceConfiguration**(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `__namedParameters`: [*WorkspaceConfiguration*](/latest/node/nx-devkit/index#workspaceconfiguration)): *void*

Update general workspace configuration such as the default project or cli settings.

This does _not_ update projects configuration, use [updateProjectConfiguration](/latest/node/nx-devkit/index#updateprojectconfiguration) or [addProjectConfiguration](/latest/node/nx-devkit/index#addprojectconfiguration) instead.

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) |
| `__namedParameters` | [*WorkspaceConfiguration*](/latest/node/nx-devkit/index#workspaceconfiguration) |

**Returns:** *void*

___

### visitNotIgnoredFiles

▸ **visitNotIgnoredFiles**(`tree`: [*Tree*](/latest/node/nx-devkit/index#tree), `dirPath?`: *string*, `visitor`: (`path`: *string*) => *void*): *void*

Utility to act on all files in a tree that are not ignored by git.

#### Parameters

| Name | Type |
| :------ | :------ |
| `tree` | [*Tree*](/latest/node/nx-devkit/index#tree) |
| `dirPath` | *string* |
| `visitor` | (`path`: *string*) => *void* |

**Returns:** *void*

___

### writeJson

▸ **writeJson**<T\>(`host`: [*Tree*](/latest/node/nx-devkit/index#tree), `path`: *string*, `value`: T): *void*

Writes a JSON value to the file system tree

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/node/nx-devkit/index#tree) | File system tree |
| `path` | *string* | Path of JSON file in the Tree |
| `value` | T | Serializable value to write |

**Returns:** *void*
