Ƭ **TaskGraphExecutor**\<`T`\>: (`taskGraph`: [`TaskGraph`](/docs/reference/devkit/TaskGraph), `options`: `Record`\<`string`, `T`\>, `overrides`: `T`, `context`: [`ExecutorContext`](/docs/reference/devkit/ExecutorContext)) => `Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>

Implementation of a target of a project that handles multiple projects to be batched

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `any` |

#### Type declaration

▸ (`taskGraph`, `options`, `overrides`, `context`): `Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `taskGraph` | [`TaskGraph`](/docs/reference/devkit/TaskGraph) |
| `options` | `Record`\<`string`, `T`\> |
| `overrides` | `T` |
| `context` | [`ExecutorContext`](/docs/reference/devkit/ExecutorContext) |

##### Returns

`Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>
