# Function: runExecutor

▸ **runExecutor**\<`T`\>(`targetDescription`, `overrides`, `context`): `Promise`\<`AsyncIterableIterator`\<`T`\>\>

Loads and invokes executor.

This is analogous to invoking executor from the terminal, with the exception
that the params aren't parsed from the string, but instead provided parsed already.

Apart from that, it works the same way:

- it will load the workspace configuration
- it will resolve the target
- it will load the executor and the schema
- it will load the options for the appropriate configuration
- it will run the validations and will set the default
- and, of course, it will invoke the executor

Example:

```typescript
for await (const s of await runExecutor(
  { project: 'myproj', target: 'serve' },
  { watch: true },
  context
)) {
  // s.success
}
```

Note that the return value is a promise of an iterator, so you need to await before iterating over it.

#### Type parameters

| Name | Type             |
| :--- | :--------------- |
| `T`  | extends `Object` |

#### Parameters

| Name                | Type                                                                      |
| :------------------ | :------------------------------------------------------------------------ |
| `targetDescription` | [`Target`](/reference/core-api/devkit/documents/Target)                   |
| `overrides`         | `Object`                                                                  |
| `context`           | [`ExecutorContext`](/reference/core-api/devkit/documents/ExecutorContext) |

#### Returns

`Promise`\<`AsyncIterableIterator`\<`T`\>\>
