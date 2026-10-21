▸ **readCachedProjectGraph**(`minimumComputedAt?`): [`ProjectGraph`](/docs/reference/devkit/ProjectGraph)

Synchronously reads the latest cached copy of the workspace's ProjectGraph.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `minimumComputedAt?` | `number` | The minimum timestamp that the cached ProjectGraph must have been computed at. |

#### Returns

[`ProjectGraph`](/docs/reference/devkit/ProjectGraph)

**`Throws`**

if there is no cached ProjectGraph to read from
