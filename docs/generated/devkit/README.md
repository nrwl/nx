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

- [ChangeType](../../devkit/documents/ChangeType): Enum ChangeType
- [DependencyType](../../devkit/documents/DependencyType): Enum DependencyType

### Classes

- [ProjectGraphBuilder](../../devkit/documents/ProjectGraphBuilder): Class ProjectGraphBuilder
- [Workspaces](../../devkit/documents/Workspaces): Class Workspaces

### Interfaces

- [CreateDependenciesContext](../../devkit/documents/CreateDependenciesContext): Interface CreateDependenciesContext
- [CreateNodesContext](../../devkit/documents/CreateNodesContext): Interface CreateNodesContext
- [DefaultTasksRunnerOptions](../../devkit/documents/DefaultTasksRunnerOptions): Interface DefaultTasksRunnerOptions
- [ExecutorContext](../../devkit/documents/ExecutorContext): Interface ExecutorContext
- [ExecutorsJson](../../devkit/documents/ExecutorsJson): Interface ExecutorsJson
- [FileChange](../../devkit/documents/FileChange): Interface FileChange
- [FileData](../../devkit/documents/FileData): Interface FileData
- [GeneratorsJson](../../devkit/documents/GeneratorsJson): Interface GeneratorsJson
- [Hash](../../devkit/documents/Hash): Interface Hash
- [HasherContext](../../devkit/documents/HasherContext): Interface HasherContext
- [ImplicitJsonSubsetDependency](../../devkit/documents/ImplicitJsonSubsetDependency): Interface ImplicitJsonSubsetDependency&lt;T&gt;
- [JsonParseOptions](../../devkit/documents/JsonParseOptions): Interface JsonParseOptions
- [JsonSerializeOptions](../../devkit/documents/JsonSerializeOptions): Interface JsonSerializeOptions
- [MigrationsJson](../../devkit/documents/MigrationsJson): Interface MigrationsJson
- [ModuleFederationConfig](../../devkit/documents/ModuleFederationConfig): Interface ModuleFederationConfig
- [NxAffectedConfig](../../devkit/documents/NxAffectedConfig): Interface NxAffectedConfig
- [NxJsonConfiguration](../../devkit/documents/NxJsonConfiguration): Interface NxJsonConfiguration&lt;T&gt;
- [ProjectConfiguration](../../devkit/documents/ProjectConfiguration): Interface ProjectConfiguration
- [ProjectFileMap](../../devkit/documents/ProjectFileMap): Interface ProjectFileMap
- [ProjectGraph](../../devkit/documents/ProjectGraph): Interface ProjectGraph
- [ProjectGraphDependency](../../devkit/documents/ProjectGraphDependency): Interface ProjectGraphDependency
- [ProjectGraphDependencyWithFile](../../devkit/documents/ProjectGraphDependencyWithFile): Interface ProjectGraphDependencyWithFile
- [ProjectGraphExternalNode](../../devkit/documents/ProjectGraphExternalNode): Interface ProjectGraphExternalNode
- [ProjectGraphProcessorContext](../../devkit/documents/ProjectGraphProcessorContext): Interface ProjectGraphProcessorContext
- [ProjectGraphProjectNode](../../devkit/documents/ProjectGraphProjectNode): Interface ProjectGraphProjectNode
- [ProjectsConfigurations](../../devkit/documents/ProjectsConfigurations): Interface ProjectsConfigurations
- [RemoteCache](../../devkit/documents/RemoteCache): Interface RemoteCache
- [SharedLibraryConfig](../../devkit/documents/SharedLibraryConfig): Interface SharedLibraryConfig
- [StringDeletion](../../devkit/documents/StringDeletion): Interface StringDeletion
- [StringInsertion](../../devkit/documents/StringInsertion): Interface StringInsertion
- [Target](../../devkit/documents/Target): Interface Target
- [TargetConfiguration](../../devkit/documents/TargetConfiguration): Interface TargetConfiguration&lt;T&gt;
- [TargetDependencyConfig](../../devkit/documents/TargetDependencyConfig): Interface TargetDependencyConfig
- [Task](../../devkit/documents/Task): Interface Task
- [TaskGraph](../../devkit/documents/TaskGraph): Interface TaskGraph
- [TaskHasher](../../devkit/documents/TaskHasher): Interface TaskHasher
- [Tree](../../devkit/documents/Tree): Interface Tree
- [Workspace](../../devkit/documents/Workspace): Interface Workspace

### Type Aliases

- [AdditionalSharedConfig](../../devkit/documents/AdditionalSharedConfig): (string | [libraryName: string, sharedConfig: SharedLibraryConfig] | Object)[]
- [CreateDependencies](../../devkit/documents/CreateDependencies): Function
- [CreateNodes](../../devkit/documents/CreateNodes): [projectFilePattern: string, createNodesFunction: CreateNodesFunction]
- [CreateNodesFunction](../../devkit/documents/CreateNodesFunction): Function
- [CustomHasher](../../devkit/documents/CustomHasher): Function
- [Executor](../../devkit/documents/Executor): Function
- [Generator](../../devkit/documents/Generator): Function
- [GeneratorCallback](../../devkit/documents/GeneratorCallback): Function
- [Hasher](../../devkit/documents/Hasher): TaskHasher
- [ImplicitDependencyEntry](../../devkit/documents/ImplicitDependencyEntry): Object
- [ModuleFederationLibrary](../../devkit/documents/ModuleFederationLibrary): Object
- [NxPlugin](../../devkit/documents/NxPlugin): NxPluginV1 | NxPluginV2
- [NxPluginV1](../../devkit/documents/NxPluginV1): Object
- [NxPluginV2](../../devkit/documents/NxPluginV2): Object
- [PackageManager](../../devkit/documents/PackageManager): &quot;yarn&quot; | &quot;pnpm&quot; | &quot;npm&quot;
- [ProjectGraphNode](../../devkit/documents/ProjectGraphNode): ProjectGraphProjectNode | ProjectGraphExternalNode
- [ProjectTargetConfigurator](../../devkit/documents/ProjectTargetConfigurator): Function
- [ProjectType](../../devkit/documents/ProjectType): &quot;library&quot; | &quot;application&quot;
- [Remotes](../../devkit/documents/Remotes): string[] | [remoteName: string, remoteUrl: string][]
- [SharedFunction](../../devkit/documents/SharedFunction): Function
- [SharedWorkspaceLibraryConfig](../../devkit/documents/SharedWorkspaceLibraryConfig): Object
- [StringChange](../../devkit/documents/StringChange): StringInsertion | StringDeletion
- [TaskGraphExecutor](../../devkit/documents/TaskGraphExecutor): Function
- [WorkspaceConfiguration](../../devkit/documents/WorkspaceConfiguration): Omit&lt;ProjectsConfigurations, &quot;projects&quot;&gt; &amp; Partial&lt;NxJsonConfiguration&gt;
- [WorkspaceJsonConfiguration](../../devkit/documents/WorkspaceJsonConfiguration): ProjectsConfigurations
- [WorkspaceLibrary](../../devkit/documents/WorkspaceLibrary): Object
- [WorkspaceLibrarySecondaryEntryPoint](../../devkit/documents/WorkspaceLibrarySecondaryEntryPoint): Object

### Variables

- [NX_VERSION](../../devkit/documents/NX_VERSION): string
- [appRootPath](../../devkit/documents/appRootPath): string
- [cacheDir](../../devkit/documents/cacheDir): string
- [logger](../../devkit/documents/logger): Object
- [output](../../devkit/documents/output): CLIOutput
- [workspaceRoot](../../devkit/documents/workspaceRoot): string

### Functions

- [addDependenciesToPackageJson](../../devkit/documents/addDependenciesToPackageJson)
- [addProjectConfiguration](../../devkit/documents/addProjectConfiguration)
- [applyAdditionalShared](../../devkit/documents/applyAdditionalShared)
- [applyChangesToString](../../devkit/documents/applyChangesToString)
- [applySharedFunction](../../devkit/documents/applySharedFunction)
- [convertNxExecutor](../../devkit/documents/convertNxExecutor)
- [convertNxGenerator](../../devkit/documents/convertNxGenerator)
- [createProjectFileMapUsingProjectGraph](../../devkit/documents/createProjectFileMapUsingProjectGraph)
- [createProjectGraphAsync](../../devkit/documents/createProjectGraphAsync)
- [defaultTasksRunner](../../devkit/documents/defaultTasksRunner)
- [detectPackageManager](../../devkit/documents/detectPackageManager)
- [ensurePackage](../../devkit/documents/ensurePackage)
- [extractLayoutDirectory](../../devkit/documents/extractLayoutDirectory)
- [formatFiles](../../devkit/documents/formatFiles)
- [generateFiles](../../devkit/documents/generateFiles)
- [getDependentPackagesForProject](../../devkit/documents/getDependentPackagesForProject)
- [getNpmPackageSharedConfig](../../devkit/documents/getNpmPackageSharedConfig)
- [getOutputsForTargetAndConfiguration](../../devkit/documents/getOutputsForTargetAndConfiguration)
- [getPackageManagerCommand](../../devkit/documents/getPackageManagerCommand)
- [getPackageManagerVersion](../../devkit/documents/getPackageManagerVersion)
- [getProjects](../../devkit/documents/getProjects)
- [getWorkspaceLayout](../../devkit/documents/getWorkspaceLayout)
- [getWorkspacePath](../../devkit/documents/getWorkspacePath)
- [hashArray](../../devkit/documents/hashArray)
- [installPackagesTask](../../devkit/documents/installPackagesTask)
- [isStandaloneProject](../../devkit/documents/isStandaloneProject)
- [joinPathFragments](../../devkit/documents/joinPathFragments)
- [mapRemotes](../../devkit/documents/mapRemotes)
- [mapRemotesForSSR](../../devkit/documents/mapRemotesForSSR)
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
- [readRootPackageJson](../../devkit/documents/readRootPackageJson)
- [readTargetOptions](../../devkit/documents/readTargetOptions)
- [readWorkspaceConfiguration](../../devkit/documents/readWorkspaceConfiguration)
- [removeDependenciesFromPackageJson](../../devkit/documents/removeDependenciesFromPackageJson)
- [removeProjectConfiguration](../../devkit/documents/removeProjectConfiguration)
- [reverse](../../devkit/documents/reverse)
- [runExecutor](../../devkit/documents/runExecutor)
- [runTasksInSerial](../../devkit/documents/runTasksInSerial)
- [serializeJson](../../devkit/documents/serializeJson)
- [sharePackages](../../devkit/documents/sharePackages)
- [shareWorkspaceLibraries](../../devkit/documents/shareWorkspaceLibraries)
- [stripIndents](../../devkit/documents/stripIndents)
- [stripJsonComments](../../devkit/documents/stripJsonComments)
- [targetToTargetString](../../devkit/documents/targetToTargetString)
- [toJS](../../devkit/documents/toJS)
- [updateJson](../../devkit/documents/updateJson)
- [updateNxJson](../../devkit/documents/updateNxJson)
- [updateProjectConfiguration](../../devkit/documents/updateProjectConfiguration)
- [updateTsConfigsToJs](../../devkit/documents/updateTsConfigsToJs)
- [updateWorkspaceConfiguration](../../devkit/documents/updateWorkspaceConfiguration)
- [validateDependency](../../devkit/documents/validateDependency)
- [visitNotIgnoredFiles](../../devkit/documents/visitNotIgnoredFiles)
- [workspaceLayout](../../devkit/documents/workspaceLayout)
- [writeJson](../../devkit/documents/writeJson)
- [writeJsonFile](../../devkit/documents/writeJsonFile)
