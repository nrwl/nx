# Class: ProjectGraphBuilder

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

## Properties

### fileMap

• `Private` `Readonly` **fileMap**: [`ProjectFileMap`](../../devkit/documents/ProjectFileMap)

---

### graph

• `Readonly` **graph**: [`ProjectGraph`](../../devkit/documents/ProjectGraph)

---

### removedEdges

• `Readonly` **removedEdges**: `Object` = `{}`

#### Index signature

▪ [source: `string`]: `Set`<`string`\>

## Methods

### addDependency

▸ `Private` **addDependency**(`sourceProjectName`, `targetProjectName`, `type`, `sourceProjectFile?`): `void`

#### Parameters

| Name                 | Type                                                      |
| :------------------- | :-------------------------------------------------------- |
| `sourceProjectName`  | `string`                                                  |
| `targetProjectName`  | `string`                                                  |
| `type`               | [`DependencyType`](../../devkit/documents/DependencyType) |
| `sourceProjectFile?` | `string`                                                  |

#### Returns

`void`

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
