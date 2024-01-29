# Type alias: TaskGraphExecutor\<T\>

Ƭ **TaskGraphExecutor**\<`T`\>: (`taskGraph`: [`TaskGraph`](../../devkit/documents/TaskGraph), `options`: `Record`\<`string`, `T`\>, `overrides`: `T`, `context`: [`ExecutorContext`](../../devkit/documents/ExecutorContext)) => `Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`taskGraph`, `options`, `overrides`, `context`): `Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>

Implementation of a target of a project that handles multiple projects to be batched

##### Parameters

| Name        | Type                                                        |
| :---------- | :---------------------------------------------------------- |
| `taskGraph` | [`TaskGraph`](../../devkit/documents/TaskGraph)             |
| `options`   | `Record`\<`string`, `T`\>                                   |
| `overrides` | `T`                                                         |
| `context`   | [`ExecutorContext`](../../devkit/documents/ExecutorContext) |

##### Returns

`Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>
