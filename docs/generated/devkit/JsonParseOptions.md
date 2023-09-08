# Interface: JsonParseOptions

## Hierarchy

- `ParseOptions`

  ↳ **`JsonParseOptions`**

## Table of contents

### Properties

- [allowEmptyContent](../../devkit/documents/JsonParseOptions#allowemptycontent): boolean
- [allowTrailingComma](../../devkit/documents/JsonParseOptions#allowtrailingcomma): boolean
- [disallowComments](../../devkit/documents/JsonParseOptions#disallowcomments): boolean
- [expectComments](../../devkit/documents/JsonParseOptions#expectcomments): boolean

## Properties

### allowEmptyContent

• `Optional` **allowEmptyContent**: `boolean`

#### Inherited from

ParseOptions.allowEmptyContent

---

### allowTrailingComma

• `Optional` **allowTrailingComma**: `boolean`

Allow trailing commas in the JSON content

#### Overrides

ParseOptions.allowTrailingComma

---

### disallowComments

• `Optional` **disallowComments**: `boolean`

Disallow javascript-style

**`Default`**

```ts
false;
```

#### Overrides

ParseOptions.disallowComments

---

### expectComments

• `Optional` **expectComments**: `boolean`

Expect JSON with javascript-style

**`Default`**

```ts
false;
```
