# Interface: JsonParseOptions

## Hierarchy

- `ParseOptions`

  ↳ **`JsonParseOptions`**

## Table of contents

### Properties

- [allowEmptyContent](/reference/core-api/devkit/documents/JsonParseOptions#allowemptycontent): boolean
- [allowTrailingComma](/reference/core-api/devkit/documents/JsonParseOptions#allowtrailingcomma): boolean
- [disallowComments](/reference/core-api/devkit/documents/JsonParseOptions#disallowcomments): boolean
- [expectComments](/reference/core-api/devkit/documents/JsonParseOptions#expectcomments): boolean

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
