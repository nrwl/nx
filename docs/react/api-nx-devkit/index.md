# Module: index

## Table of contents

### Enumerations

- [ChangeType](/latest/react/nx-devkit/index#changetype)
- [DependencyType](/latest/react/nx-devkit/index#dependencytype)

### Classes

- [ProjectGraphBuilder](/latest/react/nx-devkit/index#projectgraphbuilder)

### Interfaces

- [ExecutorContext](/latest/react/nx-devkit/index#executorcontext)
- [FileChange](/latest/react/nx-devkit/index#filechange)
- [FileData](/latest/react/nx-devkit/index#filedata)
- [ImplicitJsonSubsetDependency](/latest/react/nx-devkit/index#implicitjsonsubsetdependency)
- [NxAffectedConfig](/latest/react/nx-devkit/index#nxaffectedconfig)
- [NxJsonConfiguration](/latest/react/nx-devkit/index#nxjsonconfiguration)
- [NxJsonProjectConfiguration](/latest/react/nx-devkit/index#nxjsonprojectconfiguration)
- [NxPlugin](/latest/react/nx-devkit/index#nxplugin)
- [ProjectConfiguration](/latest/react/nx-devkit/index#projectconfiguration)
- [ProjectFileMap](/latest/react/nx-devkit/index#projectfilemap)
- [ProjectGraph](/latest/react/nx-devkit/index#projectgraph)
- [ProjectGraphDependency](/latest/react/nx-devkit/index#projectgraphdependency)
- [ProjectGraphNode](/latest/react/nx-devkit/index#projectgraphnode)
- [ProjectGraphProcessorContext](/latest/react/nx-devkit/index#projectgraphprocessorcontext)
- [StringDeletion](/latest/react/nx-devkit/index#stringdeletion)
- [StringInsertion](/latest/react/nx-devkit/index#stringinsertion)
- [Target](/latest/react/nx-devkit/index#target)
- [TargetConfiguration](/latest/react/nx-devkit/index#targetconfiguration)
- [TargetDependencyConfig](/latest/react/nx-devkit/index#targetdependencyconfig)
- [Tree](/latest/react/nx-devkit/index#tree)
- [Workspace](/latest/react/nx-devkit/index#workspace)
- [WorkspaceJsonConfiguration](/latest/react/nx-devkit/index#workspacejsonconfiguration)

### Type aliases

- [Executor](/latest/react/nx-devkit/index#executor)
- [Generator](/latest/react/nx-devkit/index#generator)
- [GeneratorCallback](/latest/react/nx-devkit/index#generatorcallback)
- [ImplicitDependencyEntry](/latest/react/nx-devkit/index#implicitdependencyentry)
- [PackageManager](/latest/react/nx-devkit/index#packagemanager)
- [ProjectType](/latest/react/nx-devkit/index#projecttype)
- [StringChange](/latest/react/nx-devkit/index#stringchange)
- [WorkspaceConfiguration](/latest/react/nx-devkit/index#workspaceconfiguration)

### Variables

- [logger](/latest/react/nx-devkit/index#logger)

### Functions

- [addDependenciesToPackageJson](/latest/react/nx-devkit/index#adddependenciestopackagejson)
- [addProjectConfiguration](/latest/react/nx-devkit/index#addprojectconfiguration)
- [applyChangesToString](/latest/react/nx-devkit/index#applychangestostring)
- [convertNxExecutor](/latest/react/nx-devkit/index#convertnxexecutor)
- [convertNxGenerator](/latest/react/nx-devkit/index#convertnxgenerator)
- [formatFiles](/latest/react/nx-devkit/index#formatfiles)
- [generateFiles](/latest/react/nx-devkit/index#generatefiles)
- [getPackageManagerCommand](/latest/react/nx-devkit/index#getpackagemanagercommand)
- [getProjects](/latest/react/nx-devkit/index#getprojects)
- [getWorkspaceLayout](/latest/react/nx-devkit/index#getworkspacelayout)
- [getWorkspacePath](/latest/react/nx-devkit/index#getworkspacepath)
- [installPackagesTask](/latest/react/nx-devkit/index#installpackagestask)
- [joinPathFragments](/latest/react/nx-devkit/index#joinpathfragments)
- [names](/latest/react/nx-devkit/index#names)
- [normalizePath](/latest/react/nx-devkit/index#normalizepath)
- [offsetFromRoot](/latest/react/nx-devkit/index#offsetfromroot)
- [parseTargetString](/latest/react/nx-devkit/index#parsetargetstring)
- [readJson](/latest/react/nx-devkit/index#readjson)
- [readProjectConfiguration](/latest/react/nx-devkit/index#readprojectconfiguration)
- [readTargetOptions](/latest/react/nx-devkit/index#readtargetoptions)
- [readWorkspaceConfiguration](/latest/react/nx-devkit/index#readworkspaceconfiguration)
- [removeDependenciesFromPackageJson](/latest/react/nx-devkit/index#removedependenciesfrompackagejson)
- [removeProjectConfiguration](/latest/react/nx-devkit/index#removeprojectconfiguration)
- [runExecutor](/latest/react/nx-devkit/index#runexecutor)
- [stripIndents](/latest/react/nx-devkit/index#stripindents)
- [targetToTargetString](/latest/react/nx-devkit/index#targettotargetstring)
- [toJS](/latest/react/nx-devkit/index#tojs)
- [updateJson](/latest/react/nx-devkit/index#updatejson)
- [updateProjectConfiguration](/latest/react/nx-devkit/index#updateprojectconfiguration)
- [updateTsConfigsToJs](/latest/react/nx-devkit/index#updatetsconfigstojs)
- [updateWorkspaceConfiguration](/latest/react/nx-devkit/index#updateworkspaceconfiguration)
- [visitNotIgnoredFiles](/latest/react/nx-devkit/index#visitnotignoredfiles)
- [writeJson](/latest/react/nx-devkit/index#writejson)

## Enumerations

### ChangeType

• **ChangeType**: *object*

Defined in: [packages/devkit/src/utils/string-change.ts:1](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/string-change.ts#L1)

___

### DependencyType

• **DependencyType**: *object*

Type of dependency between projects

Defined in: [packages/devkit/src/project-graph/interfaces.ts:36](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/interfaces.ts#L36)

## Classes

### ProjectGraphBuilder

• **ProjectGraphBuilder**: *object*

Builder for adding nodes and dependencies to a [ProjectGraph](/latest/react/nx-devkit/index#projectgraph)

Defined in: [packages/devkit/src/project-graph/utils.ts:11](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/utils.ts#L11)

## Interfaces

### ExecutorContext

• **ExecutorContext**: *object*

Context that is passed into an executor

Defined in: [packages/tao/src/shared/workspace.ts:199](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L199)

___

### FileChange

• **FileChange**: *object*

Description of a file change in the Nx virtual file system/

Defined in: [packages/tao/src/shared/tree.ts:74](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/tree.ts#L74)

___

### FileData

• **FileData**: *object*

Some metadata about a file

Defined in: [packages/devkit/src/project-graph/interfaces.ts:9](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/interfaces.ts#L9)

___

### ImplicitJsonSubsetDependency

• **ImplicitJsonSubsetDependency**<T\>: *object*

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | ``"*"`` \| *string*[] |

Defined in: [packages/tao/src/shared/nx.ts:7](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/nx.ts#L7)

___

### NxAffectedConfig

• **NxAffectedConfig**: *object*

Defined in: [packages/tao/src/shared/nx.ts:11](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/nx.ts#L11)

___

### NxJsonConfiguration

• **NxJsonConfiguration**<T\>: *object*

Nx.json configuration

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | ``"*"`` \| *string*[] |

Defined in: [packages/tao/src/shared/nx.ts:21](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/nx.ts#L21)

___

### NxJsonProjectConfiguration

• **NxJsonProjectConfiguration**: *object*

Defined in: [packages/tao/src/shared/nx.ts:69](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/nx.ts#L69)

___

### NxPlugin

• **NxPlugin**: *object*

A plugin for Nx

Defined in: [packages/devkit/src/project-graph/interfaces.ts:113](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/interfaces.ts#L113)

___

### ProjectConfiguration

• **ProjectConfiguration**: *object*

Project configuration

Defined in: [packages/tao/src/shared/workspace.ts:68](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L68)

___

### ProjectFileMap

• **ProjectFileMap**: *object*

A list of files separated by the project they belong to

Defined in: [packages/devkit/src/project-graph/interfaces.ts:18](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/interfaces.ts#L18)

___

### ProjectGraph

• **ProjectGraph**<T\>: *object*

A Graph of projects in the workspace and dependencies between them

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

Defined in: [packages/devkit/src/project-graph/interfaces.ts:25](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/interfaces.ts#L25)

___

### ProjectGraphDependency

• **ProjectGraphDependency**: *object*

A dependency between two projects

Defined in: [packages/devkit/src/project-graph/interfaces.ts:79](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/interfaces.ts#L79)

___

### ProjectGraphNode

• **ProjectGraphNode**<T\>: *object*

A node describing a project in a workspace

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

Defined in: [packages/devkit/src/project-graph/interfaces.ts:54](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/interfaces.ts#L54)

___

### ProjectGraphProcessorContext

• **ProjectGraphProcessorContext**: *object*

Additional information to be used to process a project graph

Defined in: [packages/devkit/src/project-graph/interfaces.ts:94](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/project-graph/interfaces.ts#L94)

___

### StringDeletion

• **StringDeletion**: *object*

Defined in: [packages/devkit/src/utils/string-change.ts:6](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/string-change.ts#L6)

___

### StringInsertion

• **StringInsertion**: *object*

Defined in: [packages/devkit/src/utils/string-change.ts:18](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/string-change.ts#L18)

___

### Target

• **Target**: *object*

Defined in: [packages/tao/src/commands/run.ts:22](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/commands/run.ts#L22)

___

### TargetConfiguration

• **TargetConfiguration**: *object*

Target's configuration

Defined in: [packages/tao/src/shared/workspace.ts:127](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L127)

___

### TargetDependencyConfig

• **TargetDependencyConfig**: *object*

Defined in: [packages/tao/src/shared/workspace.ts:109](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L109)

___

### Tree

• **Tree**: *object*

Virtual file system tree.

Defined in: [packages/tao/src/shared/tree.ts:16](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/tree.ts#L16)

___

### Workspace

• **Workspace**: *object*

Defined in: [packages/tao/src/shared/workspace.ts:7](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L7)

___

### WorkspaceJsonConfiguration

• **WorkspaceJsonConfiguration**: *object*

Workspace configuration

Defined in: [packages/tao/src/shared/workspace.ts:16](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L16)

## Type aliases

### Executor

Ƭ **Executor**<T\>: (`options`: T, `context`: [*ExecutorContext*](/latest/react/nx-devkit/index#executorcontext)) => *Promise*<{ `success`: *boolean*  }\> \| *AsyncIterableIterator*<{ `success`: *boolean*  }\>

Implementation of a target of a project

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Type declaration

▸ (`options`: T, `context`: [*ExecutorContext*](/latest/react/nx-devkit/index#executorcontext)): *Promise*<{ `success`: *boolean*  }\> \| *AsyncIterableIterator*<{ `success`: *boolean*  }\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `options` | T |
| `context` | [*ExecutorContext*](/latest/react/nx-devkit/index#executorcontext) |

**Returns:** *Promise*<{ `success`: *boolean*  }\> \| *AsyncIterableIterator*<{ `success`: *boolean*  }\>

Defined in: [packages/tao/src/shared/workspace.ts:186](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L186)

___

### Generator

Ƭ **Generator**<T\>: (`tree`: *any*, `schema`: T) => *void* \| [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback) \| *Promise*<void \| [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback)\>

A function that schedules updates to the filesystem to be done atomically

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *unknown* |

#### Type declaration

▸ (`tree`: *any*, `schema`: T): *void* \| [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback) \| *Promise*<void \| [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `tree` | *any* |
| `schema` | T |

**Returns:** *void* \| [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback) \| *Promise*<void \| [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback)\>

Defined in: [packages/tao/src/shared/workspace.ts:178](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L178)

___

### GeneratorCallback

Ƭ **GeneratorCallback**: () => *void* \| *Promise*<void\>

A callback function that is executed after changes are made to the file system

#### Type declaration

▸ (): *void* \| *Promise*<void\>

**Returns:** *void* \| *Promise*<void\>

Defined in: [packages/tao/src/shared/workspace.ts:173](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L173)

___

### ImplicitDependencyEntry

Ƭ **ImplicitDependencyEntry**<T\>: *object*

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | ``"*"`` \| *string*[] |

#### Type declaration

Defined in: [packages/tao/src/shared/nx.ts:3](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/nx.ts#L3)

___

### PackageManager

Ƭ **PackageManager**: ``"yarn"`` \| ``"pnpm"`` \| ``"npm"``

Defined in: [packages/tao/src/shared/package-manager.ts:5](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/package-manager.ts#L5)

___

### ProjectType

Ƭ **ProjectType**: ``"library"`` \| ``"application"``

Type of project supported

Defined in: [packages/tao/src/shared/workspace.ts:63](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/workspace.ts#L63)

___

### StringChange

Ƭ **StringChange**: [*StringInsertion*](/latest/react/nx-devkit/index#stringinsertion) \| [*StringDeletion*](/latest/react/nx-devkit/index#stringdeletion)

A change to be made to a string

Defined in: [packages/devkit/src/utils/string-change.ts:33](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/string-change.ts#L33)

___

### WorkspaceConfiguration

Ƭ **WorkspaceConfiguration**: *Omit*<[*WorkspaceJsonConfiguration*](/latest/react/nx-devkit/index#workspacejsonconfiguration), ``"projects"``\> & *Omit*<[*NxJsonConfiguration*](/latest/react/nx-devkit/index#nxjsonconfiguration), ``"projects"``\>

Defined in: [packages/devkit/src/generators/project-configuration.ts:14](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/project-configuration.ts#L14)

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

Defined in: [packages/tao/src/shared/logger.ts:9](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/logger.ts#L9)

## Functions

### addDependenciesToPackageJson

▸ **addDependenciesToPackageJson**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `dependencies`: *Record*<string, string\>, `devDependencies`: *Record*<string, string\>, `packageJsonPath?`: *string*): [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback)

Add Dependencies and Dev Dependencies to package.json

For example, `addDependenciesToPackageJson(host, { react: 'latest' }, { jest: 'latest' })`
will add `react` and `jest` to the dependencies and devDependencies sections of package.json respectively

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | - | Tree representing file system to modify |
| `dependencies` | *Record*<string, string\> | - | Dependencies to be added to the dependencies section of package.json |
| `devDependencies` | *Record*<string, string\> | - | Dependencies to be added to the devDependencies section of package.json |
| `packageJsonPath` | *string* | 'package.json' | Path to package.json |

**Returns:** [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback)

Callback to install dependencies only if necessary. undefined is returned if changes are not necessary.

Defined in: [packages/devkit/src/utils/package-json.ts:18](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/package-json.ts#L18)

___

### addProjectConfiguration

▸ **addProjectConfiguration**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `projectName`: *string*, `projectConfiguration`: [*ProjectConfiguration*](/latest/react/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/react/nx-devkit/index#nxjsonprojectconfiguration)): *void*

Adds project configuration to the Nx workspace.

The project configuration is stored in workspace.json and nx.json. The utility will update
both files.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | the file system tree |
| `projectName` | *string* | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [*ProjectConfiguration*](/latest/react/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/react/nx-devkit/index#nxjsonprojectconfiguration) | project configuration |

**Returns:** *void*

Defined in: [packages/devkit/src/generators/project-configuration.ts:30](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/project-configuration.ts#L30)

___

### applyChangesToString

▸ **applyChangesToString**(`text`: *string*, `changes`: [*StringChange*](/latest/react/nx-devkit/index#stringchange)[]): *string*

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
| `changes` | [*StringChange*](/latest/react/nx-devkit/index#stringchange)[] |

**Returns:** *string*

Defined in: [packages/devkit/src/utils/string-change.ts:66](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/string-change.ts#L66)

___

### convertNxExecutor

▸ **convertNxExecutor**(`executor`: [*Executor*](/latest/react/nx-devkit/index#executor)): *any*

Convert an Nx Executor into an Angular Devkit Builder

Use this to expose a compatible Angular Builder

#### Parameters

| Name | Type |
| :------ | :------ |
| `executor` | [*Executor*](/latest/react/nx-devkit/index#executor) |

**Returns:** *any*

Defined in: [packages/devkit/src/utils/convert-nx-executor.ts:11](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/convert-nx-executor.ts#L11)

___

### convertNxGenerator

▸ **convertNxGenerator**<T\>(`generator`: [*Generator*](/latest/react/nx-devkit/index#generator)<T\>): *function*

Convert an Nx Generator into an Angular Devkit Schematic

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Parameters

| Name | Type |
| :------ | :------ |
| `generator` | [*Generator*](/latest/react/nx-devkit/index#generator)<T\> |

**Returns:** (`options`: T) => (`tree`: *any*, `context`: *any*) => *Promise*<any\>

Defined in: [packages/devkit/src/utils/invoke-nx-generator.ts:36](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/invoke-nx-generator.ts#L36)

___

### formatFiles

▸ **formatFiles**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree)): *Promise*<void\>

Formats all the created or updated files using Prettier

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | the file system tree |

**Returns:** *Promise*<void\>

Defined in: [packages/devkit/src/generators/format-files.ts:12](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/format-files.ts#L12)

___

### generateFiles

▸ **generateFiles**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `srcFolder`: *string*, `target`: *string*, `substitutions`: { [k: string]: *any*;  }): *void*

Generates a folder of files based on provided templates.

While doing so it performs two substitutions:
- Substitutes segments of file names surrounded by __
- Uses ejs to substitute values in templates

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | the file system tree |
| `srcFolder` | *string* | the source folder of files (absolute path) |
| `target` | *string* | the target folder (relative to the host root) |
| `substitutions` | *object* | an object of key-value pairs  Examples:  ```typescript generateFiles(host, path.join(__dirname , 'files'), './tools/scripts', {tmpl: '', name: 'myscript'}) ```  This command will take all the files from the `files` directory next to the place where the command is invoked from. It will replace all `__tmpl__` with '' and all `__name__` with 'myscript' in the file names, and will replace all `<%= name %>` with `myscript` in the files themselves.  `tmpl: ''` is a common pattern. With it you can name files like this: `index.ts__tmpl__`, so your editor doesn't get confused about incorrect TypeScript files. |

**Returns:** *void*

Defined in: [packages/devkit/src/generators/generate-files.ts:57](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/generate-files.ts#L57)

___

### getPackageManagerCommand

▸ **getPackageManagerCommand**(`packageManager?`: [*PackageManager*](/latest/react/nx-devkit/index#packagemanager)): *object*

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
| `packageManager` | [*PackageManager*](/latest/react/nx-devkit/index#packagemanager) |

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

Defined in: [packages/tao/src/shared/package-manager.ts:27](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/shared/package-manager.ts#L27)

___

### getProjects

▸ **getProjects**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree)): *Map*<string, [*ProjectConfiguration*](/latest/react/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/react/nx-devkit/index#nxjsonprojectconfiguration)\>

Get a map of all projects in a workspace.

Use [readProjectConfiguration](/latest/react/nx-devkit/index#readprojectconfiguration) if only one project is needed.

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) |

**Returns:** *Map*<string, [*ProjectConfiguration*](/latest/react/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/react/nx-devkit/index#nxjsonprojectconfiguration)\>

Defined in: [packages/devkit/src/generators/project-configuration.ts:74](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/project-configuration.ts#L74)

___

### getWorkspaceLayout

▸ **getWorkspaceLayout**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree)): *object*

Returns workspace defaults. It includes defaults folders for apps and libs,
and the default scope.

Example:

`{ appsDir: 'apps', libsDir: 'libs', npmScope: 'myorg' }`

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | file system tree |

**Returns:** *object*

| Name | Type |
| :------ | :------ |
| `appsDir` | *string* |
| `libsDir` | *string* |
| `npmScope` | *string* |

Defined in: [packages/devkit/src/utils/get-workspace-layout.ts:14](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/get-workspace-layout.ts#L14)

___

### getWorkspacePath

▸ **getWorkspacePath**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree)): *string*

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) |

**Returns:** *string*

Defined in: [packages/devkit/src/utils/get-workspace-layout.ts:25](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/get-workspace-layout.ts#L25)

___

### installPackagesTask

▸ **installPackagesTask**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `alwaysRun?`: *boolean*, `cwd?`: *string*, `packageManager?`: [*PackageManager*](/latest/react/nx-devkit/index#packagemanager)): *void*

Runs `npm install` or `yarn install`. It will skip running the install if
`package.json` hasn't changed at all or it hasn't changed since the last invocation.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | - | the file system tree |
| `alwaysRun` | *boolean* | false | always run the command even if `package.json` hasn't changed. |
| `cwd` | *string* | '' | - |
| `packageManager` | [*PackageManager*](/latest/react/nx-devkit/index#packagemanager) | - | - |

**Returns:** *void*

Defined in: [packages/devkit/src/tasks/install-packages-task.ts:20](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/tasks/install-packages-task.ts#L20)

___

### joinPathFragments

▸ **joinPathFragments**(...`fragments`: *string*[]): *string*

Normalized path fragments and joins them

#### Parameters

| Name | Type |
| :------ | :------ |
| `...fragments` | *string*[] |

**Returns:** *string*

Defined in: [packages/devkit/src/utils/path.ts:17](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/path.ts#L17)

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

Defined in: [packages/devkit/src/utils/names.ts:12](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/names.ts#L12)

___

### normalizePath

▸ **normalizePath**(`osSpecificPath`: *string*): *string*

Coverts an os specific path to a unix style path

#### Parameters

| Name | Type |
| :------ | :------ |
| `osSpecificPath` | *string* |

**Returns:** *string*

Defined in: [packages/devkit/src/utils/path.ts:10](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/path.ts#L10)

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

Defined in: [packages/devkit/src/utils/offset-from-root.ts:15](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/offset-from-root.ts#L15)

___

### parseTargetString

▸ **parseTargetString**(`targetString`: *string*): [*Target*](/latest/react/nx-devkit/index#target)

Parses a target string into {project, target, configuration}

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `targetString` | *string* | target reference  Examples:  ```typescript parseTargetString("proj:test") // returns { project: "proj", target: "test" } parseTargetString("proj:test:production") // returns { project: "proj", target: "test", configuration: "production" } ``` |

**Returns:** [*Target*](/latest/react/nx-devkit/index#target)

Defined in: [packages/devkit/src/executors/parse-target-string.ts:15](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/executors/parse-target-string.ts#L15)

___

### readJson

▸ **readJson**<T\>(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `path`: *string*): T

Reads a document for host, removes all comments and parses JSON.

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | file system tree |
| `path` | *string* | file path |

**Returns:** T

Defined in: [packages/devkit/src/utils/json.ts:10](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/json.ts#L10)

___

### readProjectConfiguration

▸ **readProjectConfiguration**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `projectName`: *string*): [*ProjectConfiguration*](/latest/react/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/react/nx-devkit/index#nxjsonprojectconfiguration)

Reads a project configuration.

The project configuration is stored in workspace.json and nx.json. The utility will read
both files.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | the file system tree |
| `projectName` | *string* | unique name. Often directories are part of the name (e.g., mydir-mylib) |

**Returns:** [*ProjectConfiguration*](/latest/react/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/react/nx-devkit/index#nxjsonprojectconfiguration)

Defined in: [packages/devkit/src/generators/project-configuration.ts:160](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/project-configuration.ts#L160)

___

### readTargetOptions

▸ **readTargetOptions**<T\>(`__namedParameters`: [*Target*](/latest/react/nx-devkit/index#target), `context`: [*ExecutorContext*](/latest/react/nx-devkit/index#executorcontext)): T

Reads and combines options for a given target.

Works as if you invoked the target yourself without passing any command lint overrides.

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | [*Target*](/latest/react/nx-devkit/index#target) |
| `context` | [*ExecutorContext*](/latest/react/nx-devkit/index#executorcontext) |

**Returns:** T

Defined in: [packages/devkit/src/executors/read-target-options.ts:11](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/executors/read-target-options.ts#L11)

___

### readWorkspaceConfiguration

▸ **readWorkspaceConfiguration**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree)): [*WorkspaceConfiguration*](/latest/react/nx-devkit/index#workspaceconfiguration)

Read general workspace configuration such as the default project or cli settings

This does _not_ provide projects configuration, use [readProjectConfiguration](/latest/react/nx-devkit/index#readprojectconfiguration) instead.

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) |

**Returns:** [*WorkspaceConfiguration*](/latest/react/nx-devkit/index#workspaceconfiguration)

Defined in: [packages/devkit/src/generators/project-configuration.ts:95](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/project-configuration.ts#L95)

___

### removeDependenciesFromPackageJson

▸ **removeDependenciesFromPackageJson**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `dependencies`: *string*[], `devDependencies`: *string*[], `packageJsonPath?`: *string*): [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback)

Remove Dependencies and Dev Dependencies from package.json

For example, `removeDependenciesFromPackageJson(host, ['react'], ['jest'])`
will remove `react` and `jest` from the dependencies and devDependencies sections of package.json respectively

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | - | - |
| `dependencies` | *string*[] | - | Dependencies to be removed from the dependencies section of package.json |
| `devDependencies` | *string*[] | - | Dependencies to be removed from the devDependencies section of package.json |
| `packageJsonPath` | *string* | 'package.json' | - |

**Returns:** [*GeneratorCallback*](/latest/react/nx-devkit/index#generatorcallback)

Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.

Defined in: [packages/devkit/src/utils/package-json.ts:61](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/package-json.ts#L61)

___

### removeProjectConfiguration

▸ **removeProjectConfiguration**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `projectName`: *string*): *void*

Removes the configuration of an existing project.

The project configuration is stored in workspace.json and nx.json.
The utility will update both files.

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) |
| `projectName` | *string* |

**Returns:** *void*

Defined in: [packages/devkit/src/generators/project-configuration.ts:62](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/project-configuration.ts#L62)

___

### runExecutor

▸ **runExecutor**<T\>(`targetDescription`: { `configuration?`: *string* ; `project`: *string* ; `target`: *string*  }, `options`: { [k: string]: *any*;  }, `context`: [*ExecutorContext*](/latest/react/nx-devkit/index#executorcontext)): *Promise*<AsyncIterableIterator<T\>\>

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
| `context` | [*ExecutorContext*](/latest/react/nx-devkit/index#executorcontext) |

**Returns:** *Promise*<AsyncIterableIterator<T\>\>

Defined in: [packages/tao/src/commands/run.ts:287](https://github.com/nrwl/nx/blob/55b37cee/packages/tao/src/commands/run.ts#L287)

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

Defined in: [packages/devkit/src/utils/strip-indents.ts:14](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/strip-indents.ts#L14)

___

### targetToTargetString

▸ **targetToTargetString**(`__namedParameters`: [*Target*](/latest/react/nx-devkit/index#target)): *string*

Returns a string in the format "project:target[:configuration]" for the target

#### Parameters

| Name | Type |
| :------ | :------ |
| `__namedParameters` | [*Target*](/latest/react/nx-devkit/index#target) |

**Returns:** *string*

Defined in: [packages/devkit/src/executors/parse-target-string.ts:39](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/executors/parse-target-string.ts#L39)

___

### toJS

▸ **toJS**(`tree`: [*Tree*](/latest/react/nx-devkit/index#tree)): *void*

Rename and transpile any new typescript files created to javascript files

#### Parameters

| Name | Type |
| :------ | :------ |
| `tree` | [*Tree*](/latest/react/nx-devkit/index#tree) |

**Returns:** *void*

Defined in: [packages/devkit/src/generators/to-js.ts:6](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/to-js.ts#L6)

___

### updateJson

▸ **updateJson**<T, U\>(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `path`: *string*, `updater`: (`value`: T) => U): *void*

Updates a JSON value to the file system tree

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |
| `U` | T |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | File system tree |
| `path` | *string* | Path of JSON file in the Tree |
| `updater` | (`value`: T) => U | Function that maps the current value of a JSON document to a new value to be written to the document |

**Returns:** *void*

Defined in: [packages/devkit/src/utils/json.ts:40](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/json.ts#L40)

___

### updateProjectConfiguration

▸ **updateProjectConfiguration**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `projectName`: *string*, `projectConfiguration`: [*ProjectConfiguration*](/latest/react/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/react/nx-devkit/index#nxjsonprojectconfiguration)): *void*

Updates the configuration of an existing project.

The project configuration is stored in workspace.json and nx.json. The utility will update
both files.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | the file system tree |
| `projectName` | *string* | unique name. Often directories are part of the name (e.g., mydir-mylib) |
| `projectConfiguration` | [*ProjectConfiguration*](/latest/react/nx-devkit/index#projectconfiguration) & [*NxJsonProjectConfiguration*](/latest/react/nx-devkit/index#nxjsonprojectconfiguration) | project configuration |

**Returns:** *void*

Defined in: [packages/devkit/src/generators/project-configuration.ts:48](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/project-configuration.ts#L48)

___

### updateTsConfigsToJs

▸ **updateTsConfigsToJs**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `options`: { `projectRoot`: *string*  }): *void*

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) |
| `options` | *object* |
| `options.projectRoot` | *string* |

**Returns:** *void*

Defined in: [packages/devkit/src/generators/update-ts-configs-to-js.ts:4](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/update-ts-configs-to-js.ts#L4)

___

### updateWorkspaceConfiguration

▸ **updateWorkspaceConfiguration**(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `__namedParameters`: [*WorkspaceConfiguration*](/latest/react/nx-devkit/index#workspaceconfiguration)): *void*

Update general workspace configuration such as the default project or cli settings.

This does _not_ update projects configuration, use [updateProjectConfiguration](/latest/react/nx-devkit/index#updateprojectconfiguration) or [addProjectConfiguration](/latest/react/nx-devkit/index#addprojectconfiguration) instead.

#### Parameters

| Name | Type |
| :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) |
| `__namedParameters` | [*WorkspaceConfiguration*](/latest/react/nx-devkit/index#workspaceconfiguration) |

**Returns:** *void*

Defined in: [packages/devkit/src/generators/project-configuration.ts:111](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/project-configuration.ts#L111)

___

### visitNotIgnoredFiles

▸ **visitNotIgnoredFiles**(`tree`: [*Tree*](/latest/react/nx-devkit/index#tree), `dirPath?`: *string*, `visitor`: (`path`: *string*) => *void*): *void*

Utility to act on all files in a tree that are not ignored by git.

#### Parameters

| Name | Type |
| :------ | :------ |
| `tree` | [*Tree*](/latest/react/nx-devkit/index#tree) |
| `dirPath` | *string* |
| `visitor` | (`path`: *string*) => *void* |

**Returns:** *void*

Defined in: [packages/devkit/src/generators/visit-not-ignored-files.ts:8](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/generators/visit-not-ignored-files.ts#L8)

___

### writeJson

▸ **writeJson**<T\>(`host`: [*Tree*](/latest/react/nx-devkit/index#tree), `path`: *string*, `value`: T): *void*

Writes a JSON value to the file system tree

#### Type parameters

| Name | Default |
| :------ | :------ |
| `T` | *any* |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `host` | [*Tree*](/latest/react/nx-devkit/index#tree) | File system tree |
| `path` | *string* | Path of JSON file in the Tree |
| `value` | T | Serializable value to write |

**Returns:** *void*

Defined in: [packages/devkit/src/utils/json.ts:29](https://github.com/nrwl/nx/blob/55b37cee/packages/devkit/src/utils/json.ts#L29)
