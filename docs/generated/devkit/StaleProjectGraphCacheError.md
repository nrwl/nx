# Class: StaleProjectGraphCacheError

## Hierarchy

- `Error`

  ↳ **`StaleProjectGraphCacheError`**

## Table of contents

### Constructors

- [constructor](/reference/core-api/devkit/documents/StaleProjectGraphCacheError#constructor)

### Properties

- [cause](/reference/core-api/devkit/documents/StaleProjectGraphCacheError#cause): unknown
- [message](/reference/core-api/devkit/documents/StaleProjectGraphCacheError#message): string
- [name](/reference/core-api/devkit/documents/StaleProjectGraphCacheError#name): string
- [stack](/reference/core-api/devkit/documents/StaleProjectGraphCacheError#stack): string
- [prepareStackTrace](/reference/core-api/devkit/documents/StaleProjectGraphCacheError#preparestacktrace): Function
- [stackTraceLimit](/reference/core-api/devkit/documents/StaleProjectGraphCacheError#stacktracelimit): number

### Methods

- [captureStackTrace](/reference/core-api/devkit/documents/StaleProjectGraphCacheError#capturestacktrace)

## Constructors

### constructor

• **new StaleProjectGraphCacheError**(): [`StaleProjectGraphCacheError`](/reference/core-api/devkit/documents/StaleProjectGraphCacheError)

#### Returns

[`StaleProjectGraphCacheError`](/reference/core-api/devkit/documents/StaleProjectGraphCacheError)

#### Overrides

Error.constructor

## Properties

### cause

• `Optional` **cause**: `unknown`

#### Inherited from

Error.cause

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
