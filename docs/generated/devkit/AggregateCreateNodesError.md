# Class: AggregateCreateNodesError

This error should be thrown when a `createNodesV2` function hits a recoverable error.
It allows Nx to recieve partial results and continue processing for better UX.

## Hierarchy

- `Error`

  ↳ **`AggregateCreateNodesError`**

## Table of contents

### Constructors

- [constructor](/reference/core-api/devkit/documents/AggregateCreateNodesError#constructor)

### Properties

- [cause](/reference/core-api/devkit/documents/AggregateCreateNodesError#cause): unknown
- [errors](/reference/core-api/devkit/documents/AggregateCreateNodesError#errors): [file: string, error: Error][]
- [message](/reference/core-api/devkit/documents/AggregateCreateNodesError#message): string
- [name](/reference/core-api/devkit/documents/AggregateCreateNodesError#name): string
- [partialResults](/reference/core-api/devkit/documents/AggregateCreateNodesError#partialresults): CreateNodesResultV2
- [pluginIndex](/reference/core-api/devkit/documents/AggregateCreateNodesError#pluginindex): number
- [stack](/reference/core-api/devkit/documents/AggregateCreateNodesError#stack): string
- [prepareStackTrace](/reference/core-api/devkit/documents/AggregateCreateNodesError#preparestacktrace): Function
- [stackTraceLimit](/reference/core-api/devkit/documents/AggregateCreateNodesError#stacktracelimit): number

### Methods

- [captureStackTrace](/reference/core-api/devkit/documents/AggregateCreateNodesError#capturestacktrace)

## Constructors

### constructor

• **new AggregateCreateNodesError**(`errors`, `partialResults`): [`AggregateCreateNodesError`](/reference/core-api/devkit/documents/AggregateCreateNodesError)

Throwing this error from a `createNodesV2` function will allow Nx to continue processing and recieve partial results from your plugin.

#### Parameters

| Name             | Type                                                                              | Description                                                                                                                                                                                                      |
| :--------------- | :-------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `errors`         | [file: string, error: Error][]                                                    | An array of tuples that represent errors encountered when processing a given file. An example entry might look like ['path/to/project.json', [Error: 'Invalid JSON. Unexpected token 'a' in JSON at position 0]] |
| `partialResults` | [`CreateNodesResultV2`](/reference/core-api/devkit/documents/CreateNodesResultV2) | The partial results of the `createNodesV2` function. This should be the results for each file that didn't encounter an issue.                                                                                    |

#### Returns

[`AggregateCreateNodesError`](/reference/core-api/devkit/documents/AggregateCreateNodesError)

**`Example`**

```ts
export async function createNodesV2(files: string[]) {
  const partialResults = [];
  const errors = [];
  await Promise.all(
    files.map(async (file) => {
      try {
        const result = await createNodes(file);
        partialResults.push(result);
      } catch (e) {
        errors.push([file, e]);
      }
    })
  );
  if (errors.length > 0) {
    throw new AggregateCreateNodesError(errors, partialResults);
  }
  return partialResults;
}
```

#### Overrides

Error.constructor

## Properties

### cause

• `Optional` **cause**: `unknown`

#### Inherited from

Error.cause

---

### errors

• `Readonly` **errors**: [file: string, error: Error][]

---

### message

• **message**: `string`

#### Inherited from

Error.message

---

### name

• **name**: `string`

#### Inherited from

Error.name

---

### partialResults

• `Readonly` **partialResults**: [`CreateNodesResultV2`](/reference/core-api/devkit/documents/CreateNodesResultV2)

---

### pluginIndex

• **pluginIndex**: `number`

---

### stack

• `Optional` **stack**: `string`

#### Inherited from

Error.stack

---

### prepareStackTrace

▪ `Static` `Optional` **prepareStackTrace**: (`err`: `Error`, `stackTraces`: `CallSite`[]) => `any`

Optional override for formatting stack traces

**`See`**

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Type declaration

▸ (`err`, `stackTraces`): `any`

##### Parameters

| Name          | Type         |
| :------------ | :----------- |
| `err`         | `Error`      |
| `stackTraces` | `CallSite`[] |

##### Returns

`any`

#### Inherited from

Error.prepareStackTrace

---

### stackTraceLimit

▪ `Static` **stackTraceLimit**: `number`

#### Inherited from

Error.stackTraceLimit

## Methods

### captureStackTrace

▸ **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Create .stack property on a target object

#### Parameters

| Name              | Type       |
| :---------------- | :--------- |
| `targetObject`    | `object`   |
| `constructorOpt?` | `Function` |

#### Returns

`void`

#### Inherited from

Error.captureStackTrace
