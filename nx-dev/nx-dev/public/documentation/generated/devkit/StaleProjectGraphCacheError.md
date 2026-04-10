# Class: StaleProjectGraphCacheError

## Hierarchy

- `Error`

  ↳ **`StaleProjectGraphCacheError`**

## Table of contents

### Constructors

- [constructor](../../devkit/documents/StaleProjectGraphCacheError#constructor)

### Properties

- [cause](../../devkit/documents/StaleProjectGraphCacheError#cause): unknown
- [message](../../devkit/documents/StaleProjectGraphCacheError#message): string
- [name](../../devkit/documents/StaleProjectGraphCacheError#name): string
- [stack](../../devkit/documents/StaleProjectGraphCacheError#stack): string
- [prepareStackTrace](../../devkit/documents/StaleProjectGraphCacheError#preparestacktrace): Function
- [stackTraceLimit](../../devkit/documents/StaleProjectGraphCacheError#stacktracelimit): number

### Methods

- [captureStackTrace](../../devkit/documents/StaleProjectGraphCacheError#capturestacktrace)

## Constructors

### constructor

• **new StaleProjectGraphCacheError**(): [`StaleProjectGraphCacheError`](../../devkit/documents/StaleProjectGraphCacheError)

#### Returns

[`StaleProjectGraphCacheError`](../../devkit/documents/StaleProjectGraphCacheError)

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
