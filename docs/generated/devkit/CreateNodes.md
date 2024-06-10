# Type alias: CreateNodes\<T\>

Ƭ **CreateNodes**\<`T`\>: readonly [projectFilePattern: string, createNodesFunction: CreateNodesFunction\<T\>]

A pair of file patterns and [CreateNodesFunction](../../devkit/documents/CreateNodesFunction)

Nx 19.2+: Both original `CreateNodes` and `CreateNodesV2` are supported. Nx will only invoke `CreateNodesV2` if it is present.
Nx 20.X : The `CreateNodesV2` will be the only supported API. This typing will still exist, but be identical to `CreateNodesV2`.
Nx **will not** invoke the original `plugin.createNodes` callback. This should give plugin authors a window to transition.
Plugin authors should update their plugin's `createNodes` function to align with `CreateNodesV2` / the updated `CreateNodes`.
The plugin should contain something like: `export createNodes = createNodesV2;` during this period. This will allow the plugin
to maintain compatibility with Nx 19.2 and up.
Nx 21.X : The `CreateNodesV2` typing will be removed, as it has replaced `CreateNodes`.

**`Deprecated`**

Use [CreateNodesV2](../../devkit/documents/CreateNodesV2) instead. CreateNodesV2 will replace this API. Read more about the transition above.

#### Type parameters

| Name | Type      |
| :--- | :-------- |
| `T`  | `unknown` |
