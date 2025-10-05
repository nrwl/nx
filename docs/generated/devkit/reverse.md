# Function: reverse

▸ **reverse**(`graph`): [`ProjectGraph`](/reference/core-api/devkit/documents/ProjectGraph)

Returns a new project graph where all the edges are reversed.

For instance, if project A depends on B, in the reversed graph
B will depend on A.

#### Parameters

| Name    | Type                                                                |
| :------ | :------------------------------------------------------------------ |
| `graph` | [`ProjectGraph`](/reference/core-api/devkit/documents/ProjectGraph) |

#### Returns

[`ProjectGraph`](/reference/core-api/devkit/documents/ProjectGraph)
