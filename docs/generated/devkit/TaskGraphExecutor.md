# Type alias: TaskGraphExecutor\<T\>

Ƭ **TaskGraphExecutor**\<`T`\>: (`taskGraph`: [`TaskGraph`](/reference/core-api/devkit/documents/TaskGraph), `options`: `Record`\<`string`, `T`\>, `overrides`: `T`, `context`: [`ExecutorContext`](/reference/core-api/devkit/documents/ExecutorContext)) => `Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>

Implementation of a target of a project that handles multiple projects to be batched

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Type declaration

▸ (`taskGraph`, `options`, `overrides`, `context`): `Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>

##### Parameters

| Name        | Type                                                                      |
| :---------- | :------------------------------------------------------------------------ |
| `taskGraph` | [`TaskGraph`](/reference/core-api/devkit/documents/TaskGraph)             |
| `options`   | `Record`\<`string`, `T`\>                                                 |
| `overrides` | `T`                                                                       |
| `context`   | [`ExecutorContext`](/reference/core-api/devkit/documents/ExecutorContext) |

##### Returns

`Promise`\<`BatchExecutorResult` \| `AsyncIterableIterator`\<`BatchExecutorTaskResult`\>\>
