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

- [ChangeType](/reference/core-api/devkit/documents/ChangeType)
- [DependencyType](/reference/core-api/devkit/documents/DependencyType)
- [OverwriteStrategy](/reference/core-api/devkit/documents/OverwriteStrategy)

### Classes

- [AggregateCreateNodesError](/reference/core-api/devkit/documents/AggregateCreateNodesError)
- [StaleProjectGraphCacheError](/reference/core-api/devkit/documents/StaleProjectGraphCacheError)

### Interfaces

- [CreateDependenciesContext](/reference/core-api/devkit/documents/CreateDependenciesContext)
- [CreateNodesContextV2](/reference/core-api/devkit/documents/CreateNodesContextV2)
- [CreateNodesResult](/reference/core-api/devkit/documents/CreateNodesResult)
- [DefaultTasksRunnerOptions](/reference/core-api/devkit/documents/DefaultTasksRunnerOptions)
- [ExecutorContext](/reference/core-api/devkit/documents/ExecutorContext)
- [ExecutorsJson](/reference/core-api/devkit/documents/ExecutorsJson)
- [FileChange](/reference/core-api/devkit/documents/FileChange)
- [FileData](/reference/core-api/devkit/documents/FileData)
- [FileMap](/reference/core-api/devkit/documents/FileMap)
- [GeneratorsJson](/reference/core-api/devkit/documents/GeneratorsJson)
- [GraphJson](/reference/core-api/devkit/documents/GraphJson)
- [Hash](/reference/core-api/devkit/documents/Hash)
- [HasherContext](/reference/core-api/devkit/documents/HasherContext)
- [ImplicitJsonSubsetDependency](/reference/core-api/devkit/documents/ImplicitJsonSubsetDependency)
- [JsonParseOptions](/reference/core-api/devkit/documents/JsonParseOptions)
- [JsonSerializeOptions](/reference/core-api/devkit/documents/JsonSerializeOptions)
- [MigrationsJson](/reference/core-api/devkit/documents/MigrationsJson)
- [NxAffectedConfig](/reference/core-api/devkit/documents/NxAffectedConfig)
- [NxJsonConfiguration](/reference/core-api/devkit/documents/NxJsonConfiguration)
- [ProjectConfiguration](/reference/core-api/devkit/documents/ProjectConfiguration)
- [ProjectFileMap](/reference/core-api/devkit/documents/ProjectFileMap)
- [ProjectGraph](/reference/core-api/devkit/documents/ProjectGraph)
- [ProjectGraphDependency](/reference/core-api/devkit/documents/ProjectGraphDependency)
- [ProjectGraphExternalNode](/reference/core-api/devkit/documents/ProjectGraphExternalNode)
- [ProjectGraphProjectNode](/reference/core-api/devkit/documents/ProjectGraphProjectNode)
- [ProjectsConfigurations](/reference/core-api/devkit/documents/ProjectsConfigurations)
- [RemoteCache](/reference/core-api/devkit/documents/RemoteCache)
- [StringDeletion](/reference/core-api/devkit/documents/StringDeletion)
- [StringInsertion](/reference/core-api/devkit/documents/StringInsertion)
- [Target](/reference/core-api/devkit/documents/Target)
- [TargetConfiguration](/reference/core-api/devkit/documents/TargetConfiguration)
- [TargetDependencyConfig](/reference/core-api/devkit/documents/TargetDependencyConfig)
- [Task](/reference/core-api/devkit/documents/Task)
- [TaskGraph](/reference/core-api/devkit/documents/TaskGraph)
- [TaskHasher](/reference/core-api/devkit/documents/TaskHasher)
- [TaskResult](/reference/core-api/devkit/documents/TaskResult)
- [Tree](/reference/core-api/devkit/documents/Tree)
- [Workspace](/reference/core-api/devkit/documents/Workspace)

### Type Aliases

- [AsyncIteratorExecutor](/reference/core-api/devkit/documents/AsyncIteratorExecutor)
- [CreateDependencies](/reference/core-api/devkit/documents/CreateDependencies)
- [CreateMetadata](/reference/core-api/devkit/documents/CreateMetadata)
- [CreateMetadataContext](/reference/core-api/devkit/documents/CreateMetadataContext)
- [CreateNodesFunctionV2](/reference/core-api/devkit/documents/CreateNodesFunctionV2)
- [CreateNodesResultV2](/reference/core-api/devkit/documents/CreateNodesResultV2)
- [CreateNodesV2](/reference/core-api/devkit/documents/CreateNodesV2)
- [CustomHasher](/reference/core-api/devkit/documents/CustomHasher)
- [DynamicDependency](/reference/core-api/devkit/documents/DynamicDependency)
- [Executor](/reference/core-api/devkit/documents/Executor)
- [ExpandedPluginConfiguration](/reference/core-api/devkit/documents/ExpandedPluginConfiguration)
- [Generator](/reference/core-api/devkit/documents/Generator)
- [GeneratorCallback](/reference/core-api/devkit/documents/GeneratorCallback)
- [Hasher](/reference/core-api/devkit/documents/Hasher)
- [ImplicitDependency](/reference/core-api/devkit/documents/ImplicitDependency)
- [ImplicitDependencyEntry](/reference/core-api/devkit/documents/ImplicitDependencyEntry)
- [Migration](/reference/core-api/devkit/documents/Migration)
- [NxPlugin](/reference/core-api/devkit/documents/NxPlugin)
- [NxPluginV2](/reference/core-api/devkit/documents/NxPluginV2)
- [PackageManager](/reference/core-api/devkit/documents/PackageManager)
- [PluginConfiguration](/reference/core-api/devkit/documents/PluginConfiguration)
- [PostTasksExecution](/reference/core-api/devkit/documents/PostTasksExecution)
- [PostTasksExecutionContext](/reference/core-api/devkit/documents/PostTasksExecutionContext)
- [PreTasksExecution](/reference/core-api/devkit/documents/PreTasksExecution)
- [PreTasksExecutionContext](/reference/core-api/devkit/documents/PreTasksExecutionContext)
- [ProjectType](/reference/core-api/devkit/documents/ProjectType)
- [ProjectsMetadata](/reference/core-api/devkit/documents/ProjectsMetadata)
- [PromiseExecutor](/reference/core-api/devkit/documents/PromiseExecutor)
- [RawProjectGraphDependency](/reference/core-api/devkit/documents/RawProjectGraphDependency)
- [StaticDependency](/reference/core-api/devkit/documents/StaticDependency)
- [StringChange](/reference/core-api/devkit/documents/StringChange)
- [TargetDefaults](/reference/core-api/devkit/documents/TargetDefaults)
- [TaskGraphExecutor](/reference/core-api/devkit/documents/TaskGraphExecutor)
- [TaskResults](/reference/core-api/devkit/documents/TaskResults)
- [ToJSOptions](/reference/core-api/devkit/documents/ToJSOptions)
- [WorkspaceJsonConfiguration](/reference/core-api/devkit/documents/WorkspaceJsonConfiguration)

### Variables

- [NX_VERSION](/reference/core-api/devkit/documents/NX_VERSION): string
- [cacheDir](/reference/core-api/devkit/documents/cacheDir): string
- [logger](/reference/core-api/devkit/documents/logger): Object
- [output](/reference/core-api/devkit/documents/output): CLIOutput
- [workspaceRoot](/reference/core-api/devkit/documents/workspaceRoot): string

### Functions

- [addDependenciesToPackageJson](/reference/core-api/devkit/documents/addDependenciesToPackageJson)
- [addProjectConfiguration](/reference/core-api/devkit/documents/addProjectConfiguration)
- [applyChangesToString](/reference/core-api/devkit/documents/applyChangesToString)
- [convertNxExecutor](/reference/core-api/devkit/documents/convertNxExecutor)
- [convertNxGenerator](/reference/core-api/devkit/documents/convertNxGenerator)
- [createNodesFromFiles](/reference/core-api/devkit/documents/createNodesFromFiles)
- [createProjectFileMapUsingProjectGraph](/reference/core-api/devkit/documents/createProjectFileMapUsingProjectGraph)
- [createProjectGraphAsync](/reference/core-api/devkit/documents/createProjectGraphAsync)
- [defaultTasksRunner](/reference/core-api/devkit/documents/defaultTasksRunner)
- [detectPackageManager](/reference/core-api/devkit/documents/detectPackageManager)
- [ensurePackage](/reference/core-api/devkit/documents/ensurePackage)
- [extractLayoutDirectory](/reference/core-api/devkit/documents/extractLayoutDirectory)
- [formatFiles](/reference/core-api/devkit/documents/formatFiles)
- [generateFiles](/reference/core-api/devkit/documents/generateFiles)
- [getDependencyVersionFromPackageJson](/reference/core-api/devkit/documents/getDependencyVersionFromPackageJson)
- [getOutputsForTargetAndConfiguration](/reference/core-api/devkit/documents/getOutputsForTargetAndConfiguration)
- [getPackageManagerCommand](/reference/core-api/devkit/documents/getPackageManagerCommand)
- [getPackageManagerVersion](/reference/core-api/devkit/documents/getPackageManagerVersion)
- [getProjects](/reference/core-api/devkit/documents/getProjects)
- [getWorkspaceLayout](/reference/core-api/devkit/documents/getWorkspaceLayout)
- [glob](/reference/core-api/devkit/documents/glob)
- [globAsync](/reference/core-api/devkit/documents/globAsync)
- [hashArray](/reference/core-api/devkit/documents/hashArray)
- [installPackagesTask](/reference/core-api/devkit/documents/installPackagesTask)
- [isDaemonEnabled](/reference/core-api/devkit/documents/isDaemonEnabled)
- [isWorkspacesEnabled](/reference/core-api/devkit/documents/isWorkspacesEnabled)
- [joinPathFragments](/reference/core-api/devkit/documents/joinPathFragments)
- [moveFilesToNewDirectory](/reference/core-api/devkit/documents/moveFilesToNewDirectory)
- [names](/reference/core-api/devkit/documents/names)
- [normalizePath](/reference/core-api/devkit/documents/normalizePath)
- [offsetFromRoot](/reference/core-api/devkit/documents/offsetFromRoot)
- [parseJson](/reference/core-api/devkit/documents/parseJson)
- [parseTargetString](/reference/core-api/devkit/documents/parseTargetString)
- [readCachedProjectGraph](/reference/core-api/devkit/documents/readCachedProjectGraph)
- [readJson](/reference/core-api/devkit/documents/readJson)
- [readJsonFile](/reference/core-api/devkit/documents/readJsonFile)
- [readNxJson](/reference/core-api/devkit/documents/readNxJson)
- [readProjectConfiguration](/reference/core-api/devkit/documents/readProjectConfiguration)
- [readProjectsConfigurationFromProjectGraph](/reference/core-api/devkit/documents/readProjectsConfigurationFromProjectGraph)
- [readTargetOptions](/reference/core-api/devkit/documents/readTargetOptions)
- [removeDependenciesFromPackageJson](/reference/core-api/devkit/documents/removeDependenciesFromPackageJson)
- [removeProjectConfiguration](/reference/core-api/devkit/documents/removeProjectConfiguration)
- [reverse](/reference/core-api/devkit/documents/reverse)
- [runExecutor](/reference/core-api/devkit/documents/runExecutor)
- [runTasksInSerial](/reference/core-api/devkit/documents/runTasksInSerial)
- [serializeJson](/reference/core-api/devkit/documents/serializeJson)
- [stripIndents](/reference/core-api/devkit/documents/stripIndents)
- [stripJsonComments](/reference/core-api/devkit/documents/stripJsonComments)
- [targetToTargetString](/reference/core-api/devkit/documents/targetToTargetString)
- [toJS](/reference/core-api/devkit/documents/toJS)
- [updateJson](/reference/core-api/devkit/documents/updateJson)
- [updateNxJson](/reference/core-api/devkit/documents/updateNxJson)
- [updateProjectConfiguration](/reference/core-api/devkit/documents/updateProjectConfiguration)
- [updateTsConfigsToJs](/reference/core-api/devkit/documents/updateTsConfigsToJs)
- [validateDependency](/reference/core-api/devkit/documents/validateDependency)
- [visitNotIgnoredFiles](/reference/core-api/devkit/documents/visitNotIgnoredFiles)
- [workspaceLayout](/reference/core-api/devkit/documents/workspaceLayout)
- [writeJson](/reference/core-api/devkit/documents/writeJson)
- [writeJsonFile](/reference/core-api/devkit/documents/writeJsonFile)
