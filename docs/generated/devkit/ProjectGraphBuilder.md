# Class: ProjectGraphBuilder

@deprecated(v18): General project graph processors are deprecated. Replace usage with a plugin that utilizes `processProjectNodes` and `processProjectDependencies`.

## Hierarchy

- `ProjectDependencyBuilder`

  ↳ **`ProjectGraphBuilder`**

## Table of contents

### Constructors

- [constructor](../../devkit/documents/ProjectGraphBuilder#constructor)

### Properties

- [fileMap](../../devkit/documents/ProjectGraphBuilder#filemap)
- [graph](../../devkit/documents/ProjectGraphBuilder#graph)
- [removedEdges](../../devkit/documents/ProjectGraphBuilder#removededges)

### Methods

- [addDependency](../../devkit/documents/ProjectGraphBuilder#adddependency)
- [addDynamicDependency](../../devkit/documents/ProjectGraphBuilder#adddynamicdependency)
- [addExplicitDependency](../../devkit/documents/ProjectGraphBuilder#addexplicitdependency)
- [addExternalNode](../../devkit/documents/ProjectGraphBuilder#addexternalnode)
- [addImplicitDependency](../../devkit/documents/ProjectGraphBuilder#addimplicitdependency)
- [addNode](../../devkit/documents/ProjectGraphBuilder#addnode)
- [addStaticDependency](../../devkit/documents/ProjectGraphBuilder#addstaticdependency)
- [calculateAlreadySetTargetDeps](../../devkit/documents/ProjectGraphBuilder#calculatealreadysettargetdeps)
- [calculateTargetDepsFromFiles](../../devkit/documents/ProjectGraphBuilder#calculatetargetdepsfromfiles)
- [getUpdatedProjectGraph](../../devkit/documents/ProjectGraphBuilder#getupdatedprojectgraph)
- [mergeProjectGraph](../../devkit/documents/ProjectGraphBuilder#mergeprojectgraph)
- [removeDependenciesWithNode](../../devkit/documents/ProjectGraphBuilder#removedependencieswithnode)
- [removeDependency](../../devkit/documents/ProjectGraphBuilder#removedependency)
- [removeNode](../../devkit/documents/ProjectGraphBuilder#removenode)
- [setVersion](../../devkit/documents/ProjectGraphBuilder#setversion)

## Constructors

### constructor

• **new ProjectGraphBuilder**(`g?`, `fileMap?`)

#### Parameters

| Name       | Type                                                      |
| :--------- | :-------------------------------------------------------- |
| `g?`       | [`ProjectGraph`](../../devkit/documents/ProjectGraph)     |
| `fileMap?` | [`ProjectFileMap`](../../devkit/documents/ProjectFileMap) |

#### Overrides

ProjectDependencyBuilder.constructor

## Properties

### fileMap

• `Protected` `Optional` `Readonly` **fileMap**: [`ProjectFileMap`](../../devkit/documents/ProjectFileMap)

#### Inherited from

ProjectDependencyBuilder.fileMap

---

### graph

• `Readonly` **graph**: [`ProjectGraph`](../../devkit/documents/ProjectGraph)

---

### removedEdges

• `Protected` `Readonly` **removedEdges**: `Object` = `{}`

#### Index signature

▪ [source: `string`]: `Set`<`string`\>

#### Inherited from

ProjectDependencyBuilder.removedEdges

## Methods

### addDependency

▸ `Protected` **addDependency**(`sourceProjectName`, `targetProjectName`, `type`, `sourceProjectFile?`): `void`

#### Parameters

| Name                 | Type                                                      |
| :------------------- | :-------------------------------------------------------- |
| `sourceProjectName`  | `string`                                                  |
| `targetProjectName`  | `string`                                                  |
| `type`               | [`DependencyType`](../../devkit/documents/DependencyType) |
| `sourceProjectFile?` | `string`                                                  |

#### Returns

`void`

#### Inherited from

ProjectDependencyBuilder.addDependency

---

### addDynamicDependency

▸ **addDynamicDependency**(`sourceProjectName`, `targetProjectName`, `sourceProjectFile`): `void`

Adds dynamic dependency from source project to target project

#### Parameters

| Name                | Type     |
| :------------------ | :------- |
| `sourceProjectName` | `string` |
| `targetProjectName` | `string` |
| `sourceProjectFile` | `string` |

#### Returns

`void`

---

### addExplicitDependency

▸ **addExplicitDependency**(`sourceProjectName`, `sourceProjectFile`, `targetProjectName`): `void`

Add an explicit dependency from a file in source project to target project

**`Deprecated`**

this method will be removed in v17. Use [addStaticDependency](../../devkit/documents/ProjectGraphBuilder#addstaticdependency) or [addDynamicDependency](../../devkit/documents/ProjectGraphBuilder#adddynamicdependency) instead

#### Parameters

| Name                | Type     |
| :------------------ | :------- |
| `sourceProjectName` | `string` |
| `sourceProjectFile` | `string` |
| `targetProjectName` | `string` |

#### Returns

`void`

---

### addExternalNode

▸ **addExternalNode**(`node`): `void`

Adds a external node to the project graph

#### Parameters

| Name   | Type                                                                          |
| :----- | :---------------------------------------------------------------------------- |
| `node` | [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode) |

#### Returns

`void`

---

### addImplicitDependency

▸ **addImplicitDependency**(`sourceProjectName`, `targetProjectName`): `void`

Adds implicit dependency from source project to target project

#### Parameters

| Name                | Type     |
| :------------------ | :------- |
| `sourceProjectName` | `string` |
| `targetProjectName` | `string` |

#### Returns

`void`

---

### addNode

▸ **addNode**(`node`): `void`

Adds a project node to the project graph

#### Parameters

| Name   | Type                                                                        |
| :----- | :-------------------------------------------------------------------------- |
| `node` | [`ProjectGraphProjectNode`](../../devkit/documents/ProjectGraphProjectNode) |

#### Returns

`void`

---

### addStaticDependency

▸ **addStaticDependency**(`sourceProjectName`, `targetProjectName`, `sourceProjectFile?`): `void`

Adds static dependency from source project to target project

#### Parameters

| Name                 | Type     |
| :------------------- | :------- |
| `sourceProjectName`  | `string` |
| `targetProjectName`  | `string` |
| `sourceProjectFile?` | `string` |

#### Returns

`void`

---

### calculateAlreadySetTargetDeps

▸ `Private` **calculateAlreadySetTargetDeps**(`sourceProject`): `Map`<`string`, `Map`<`string`, [`ProjectGraphDependency`](../../devkit/documents/ProjectGraphDependency)\>\>

#### Parameters

| Name            | Type     |
| :-------------- | :------- |
| `sourceProject` | `string` |

#### Returns

`Map`<`string`, `Map`<`string`, [`ProjectGraphDependency`](../../devkit/documents/ProjectGraphDependency)\>\>

---

### calculateTargetDepsFromFiles

▸ `Private` **calculateTargetDepsFromFiles**(`sourceProject`): `Map`<`string`, `Set`<`string`\>\>

#### Parameters

| Name            | Type     |
| :-------------- | :------- |
| `sourceProject` | `string` |

#### Returns

`Map`<`string`, `Set`<`string`\>\>

---

### getUpdatedProjectGraph

▸ **getUpdatedProjectGraph**(): [`ProjectGraph`](../../devkit/documents/ProjectGraph)

#### Returns

[`ProjectGraph`](../../devkit/documents/ProjectGraph)

---

### mergeProjectGraph

▸ **mergeProjectGraph**(`p`): `void`

Merges the nodes and dependencies of p into the built project graph.

#### Parameters

| Name | Type                                                  |
| :--- | :---------------------------------------------------- |
| `p`  | [`ProjectGraph`](../../devkit/documents/ProjectGraph) |

#### Returns

`void`

---

### removeDependenciesWithNode

▸ `Private` **removeDependenciesWithNode**(`name`): `void`

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `name` | `string` |

#### Returns

`void`

---

### removeDependency

▸ **removeDependency**(`sourceProjectName`, `targetProjectName`): `void`

Removes a dependency from source project to target project

#### Parameters

| Name                | Type     |
| :------------------ | :------- |
| `sourceProjectName` | `string` |
| `targetProjectName` | `string` |

#### Returns

`void`

#### Inherited from

ProjectDependencyBuilder.removeDependency

---

### removeNode

▸ **removeNode**(`name`): `void`

Removes a node and all of its dependency edges from the graph

#### Parameters

| Name   | Type     |
| :----- | :------- |
| `name` | `string` |

#### Returns

`void`

---

### setVersion

▸ **setVersion**(`version`): `void`

Set version of the project graph

#### Parameters

| Name      | Type     |
| :-------- | :------- |
| `version` | `string` |

#### Returns

`void`
