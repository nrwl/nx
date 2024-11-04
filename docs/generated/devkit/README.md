# @nx/devkit

The Nx Devkit is the underlying technology used to customize Nx to support
different technologies and custom use-cases. It contains many utility
functions for reading and writing files, updating configuration,
working with Abstract Syntax Trees(ASTs), and more.

As with most things in Nx, the core of Nx Devkit is very simple.
It only uses language primitives and immutable objects
(the tree being the only exception).

## Table of contents

### Enumerations

- [ChangeType](../../devkit/documents/ChangeType)
- [DependencyType](../../devkit/documents/DependencyType)
- [OverwriteStrategy](../../devkit/documents/OverwriteStrategy)

### Classes

- [AggregateCreateNodesError](../../devkit/documents/AggregateCreateNodesError)

### Interfaces

- [CreateDependenciesContext](../../devkit/documents/CreateDependenciesContext)
- [CreateNodesContext](../../devkit/documents/CreateNodesContext)
- [CreateNodesContextV2](../../devkit/documents/CreateNodesContextV2)
- [CreateNodesResult](../../devkit/documents/CreateNodesResult)
- [DefaultTasksRunnerOptions](../../devkit/documents/DefaultTasksRunnerOptions)
- [ExecutorContext](../../devkit/documents/ExecutorContext)
- [ExecutorsJson](../../devkit/documents/ExecutorsJson)
- [FileChange](../../devkit/documents/FileChange)
- [FileData](../../devkit/documents/FileData)
- [FileMap](../../devkit/documents/FileMap)
- [GeneratorsJson](../../devkit/documents/GeneratorsJson)
- [GraphJson](../../devkit/documents/GraphJson)
- [Hash](../../devkit/documents/Hash)
- [HasherContext](../../devkit/documents/HasherContext)
- [ImplicitJsonSubsetDependency](../../devkit/documents/ImplicitJsonSubsetDependency)
- [JsonParseOptions](../../devkit/documents/JsonParseOptions)
- [JsonSerializeOptions](../../devkit/documents/JsonSerializeOptions)
- [MigrationsJson](../../devkit/documents/MigrationsJson)
- [NxAffectedConfig](../../devkit/documents/NxAffectedConfig)
- [NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration)
- [ProjectConfiguration](../../devkit/documents/ProjectConfiguration)
- [ProjectFileMap](../../devkit/documents/ProjectFileMap)
- [ProjectGraph](../../devkit/documents/ProjectGraph)
- [ProjectGraphDependency](../../devkit/documents/ProjectGraphDependency)
- [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode)
- [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode)
- [ProjectsConfigurations](../../devkit/documents/ProjectsConfigurations)
- [RemoteCache](../../devkit/documents/RemoteCache)
- [StringDeletion](../../devkit/documents/StringDeletion)
- [StringInsertion](../../devkit/documents/StringInsertion)
- [Target](../../devkit/documents/Target)
- [TargetConfiguration](../../devkit/documents/TargetConfiguration)
- [TargetDependencyConfig](../../devkit/documents/TargetDependencyConfig)
- [Task](../../devkit/documents/Task)
- [TaskGraph](../../devkit/documents/TaskGraph)
- [TaskHasher](../../devkit/documents/TaskHasher)
- [Tree](../../devkit/documents/Tree)
- [Workspace](../../devkit/documents/Workspace)

### Type Aliases

- [AsyncIteratorExecutor](../../devkit/documents/AsyncIteratorExecutor)
- [CreateDependencies](../../devkit/documents/CreateDependencies)
- [CreateMetadata](../../devkit/documents/CreateMetadata)
- [CreateMetadataContext](../../devkit/documents/CreateMetadataContext)
- [CreateNodes](../../devkit/documents/CreateNodes)
- [CreateNodesFunction](../../devkit/documents/CreateNodesFunction)
- [CreateNodesFunctionV2](../../devkit/documents/CreateNodesFunctionV2)
- [CreateNodesResultV2](../../devkit/documents/CreateNodesResultV2)
- [CreateNodesV2](../../devkit/documents/CreateNodesV2)
- [CustomHasher](../../devkit/documents/CustomHasher)
- [DynamicDependency](../../devkit/documents/DynamicDependency)
- [Executor](../../devkit/documents/Executor)
- [ExpandedPluginConfiguration](../../devkit/documents/ExpandedPluginConfiguration)
- [Generator](../../devkit/documents/Generator)
- [GeneratorCallback](../../devkit/documents/GeneratorCallback)
- [Hasher](../../devkit/documents/Hasher)
- [ImplicitDependency](../../devkit/documents/ImplicitDependency)
- [ImplicitDependencyEntry](../../devkit/documents/ImplicitDependencyEntry)
- [NxPlugin](../../devkit/documents/NxPlugin)
- [NxPluginV2](../../devkit/documents/NxPluginV2)
- [PackageManager](../../devkit/documents/PackageManager)
- [PluginConfiguration](../../devkit/documents/PluginConfiguration)
- [ProjectType](../../devkit/documents/ProjectType)
- [ProjectsMetadata](../../devkit/documents/ProjectsMetadata)
- [PromiseExecutor](../../devkit/documents/PromiseExecutor)
- [RawProjectGraphDependency](../../devkit/documents/RawProjectGraphDependency)
- [StaticDependency](../../devkit/documents/StaticDependency)
- [StringChange](../../devkit/documents/StringChange)
- [TargetDefaults](../../devkit/documents/TargetDefaults)
- [TaskGraphExecutor](../../devkit/documents/TaskGraphExecutor)
- [ToJSOptions](../../devkit/documents/ToJSOptions)
- [WorkspaceJsonConfiguration](../../devkit/documents/WorkspaceJsonConfiguration)

### Variables

- [NX_VERSION](../../devkit/documents/NX_VERSION): string
- [cacheDir](../../devkit/documents/cacheDir): string
- [logger](../../devkit/documents/logger): Object
- [output](../../devkit/documents/output): CLIOutput
- [workspaceRoot](../../devkit/documents/workspaceRoot): string

### Functions

- [addDependenciesToPackageJson](../../devkit/documents/addDependenciesToPackageJson)
- [addProjectConfiguration](../../devkit/documents/addProjectConfiguration)
- [applyChangesToString](../../devkit/documents/applyChangesToString)
- [convertNxExecutor](../../devkit/documents/convertNxExecutor)
- [convertNxGenerator](../../devkit/documents/convertNxGenerator)
- [createNodesFromFiles](../../devkit/documents/createNodesFromFiles)
- [createProjectFileMapUsingProjectGraph](../../devkit/documents/createProjectFileMapUsingProjectGraph)
- [createProjectGraphAsync](../../devkit/documents/createProjectGraphAsync)
- [defaultTasksRunner](../../devkit/documents/defaultTasksRunner)
- [detectPackageManager](../../devkit/documents/detectPackageManager)
- [ensurePackage](../../devkit/documents/ensurePackage)
- [extractLayoutDirectory](../../devkit/documents/extractLayoutDirectory)
- [formatFiles](../../devkit/documents/formatFiles)
- [generateFiles](../../devkit/documents/generateFiles)
- [getOutputsForTargetAndConfiguration](../../devkit/documents/getOutputsForTargetAndConfiguration)
- [getPackageManagerCommand](../../devkit/documents/getPackageManagerCommand)
- [getPackageManagerVersion](../../devkit/documents/getPackageManagerVersion)
- [getProjects](../../devkit/documents/getProjects)
- [getWorkspaceLayout](../../devkit/documents/getWorkspaceLayout)
- [glob](../../devkit/documents/glob)
- [globAsync](../../devkit/documents/globAsync)
- [hashArray](../../devkit/documents/hashArray)
- [installPackagesTask](../../devkit/documents/installPackagesTask)
- [isDaemonEnabled](../../devkit/documents/isDaemonEnabled)
- [isWorkspacesEnabled](../../devkit/documents/isWorkspacesEnabled)
- [joinPathFragments](../../devkit/documents/joinPathFragments)
- [moveFilesToNewDirectory](../../devkit/documents/moveFilesToNewDirectory)
- [names](../../devkit/documents/names)
- [normalizePath](../../devkit/documents/normalizePath)
- [offsetFromRoot](../../devkit/documents/offsetFromRoot)
- [parseJson](../../devkit/documents/parseJson)
- [parseTargetString](../../devkit/documents/parseTargetString)
- [readCachedProjectGraph](../../devkit/documents/readCachedProjectGraph)
- [readJson](../../devkit/documents/readJson)
- [readJsonFile](../../devkit/documents/readJsonFile)
- [readNxJson](../../devkit/documents/readNxJson)
- [readProjectConfiguration](../../devkit/documents/readProjectConfiguration)
- [readProjectsConfigurationFromProjectGraph](../../devkit/documents/readProjectsConfigurationFromProjectGraph)
- [readTargetOptions](../../devkit/documents/readTargetOptions)
- [removeDependenciesFromPackageJson](../../devkit/documents/removeDependenciesFromPackageJson)
- [removeProjectConfiguration](../../devkit/documents/removeProjectConfiguration)
- [reverse](../../devkit/documents/reverse)
- [runExecutor](../../devkit/documents/runExecutor)
- [runTasksInSerial](../../devkit/documents/runTasksInSerial)
- [serializeJson](../../devkit/documents/serializeJson)
- [stripIndents](../../devkit/documents/stripIndents)
- [stripJsonComments](../../devkit/documents/stripJsonComments)
- [targetToTargetString](../../devkit/documents/targetToTargetString)
- [toJS](../../devkit/documents/toJS)
- [updateJson](../../devkit/documents/updateJson)
- [updateNxJson](../../devkit/documents/updateNxJson)
- [updateProjectConfiguration](../../devkit/documents/updateProjectConfiguration)
- [updateTsConfigsToJs](../../devkit/documents/updateTsConfigsToJs)
- [validateDependency](../../devkit/documents/validateDependency)
- [visitNotIgnoredFiles](../../devkit/documents/visitNotIgnoredFiles)
- [workspaceLayout](../../devkit/documents/workspaceLayout)
- [writeJson](../../devkit/documents/writeJson)
- [writeJsonFile](../../devkit/documents/writeJsonFile)
