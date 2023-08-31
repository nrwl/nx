# Function: reverse

▸ **reverse**(`graph`): [`ProjectGraph`](../../devkit/documents/ProjectGraph)

Returns a new project graph where all the edges are reversed.

For instance, if project A depends on B, in the reversed graph
B will depend on A.

#### Parameters

| Name    | Type                                                  |
| :------ | :---------------------------------------------------- |
| `graph` | [`ProjectGraph`](../../devkit/documents/ProjectGraph) |

#### Returns

[`ProjectGraph`](../../devkit/documents/ProjectGraph)
